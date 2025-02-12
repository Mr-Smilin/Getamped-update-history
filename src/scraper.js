require("dotenv").config();
const SearchIndex = require("./search-index");
const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");

class WebScraper {
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
		this.outputPath = {
			root: path.join(process.cwd(), "output"),
			media: null, // 將在 scrapeElement 時設置
		};
		this.mediaPathPrefix = process.env.MEDIA_PATH || "";
	}

	async initialize(fileName) {
		const folderPath = fileName
			? path.join(this.outputPath.root, fileName)
			: this.outputPath.root;

		this.outputPath.media = path.join(folderPath, "media");
		this.currentFolder = fileName;

		await Promise.all([
			fs.mkdir(folderPath, { recursive: true }),
			fs.mkdir(this.outputPath.media, { recursive: true }),
		]);
	}

	async downloadMedia(url, fileName) {
		return new Promise((resolve, reject) => {
			const protocol = url.startsWith("https:") ? https : http;

			protocol
				.get(url, (response) => {
					if (response.statusCode !== 200) {
						console.log(new Error(`Download failed: ${response.statusCode}`));
						// 不報錯，回傳原始url
						resolve(url);
						return;
					}
					const filePath = path.join(this.outputPath.media, fileName);
					const fileStream = require("fs").createWriteStream(filePath);
					response.pipe(fileStream);
					fileStream.on("finish", () => {
						fileStream.close();
						// 修改媒體文件的相對路徑
						const relativePath = this.currentFolder
							? `${this.currentFolder}/media/${fileName}`
							: `media/${fileName}`;
						resolve(`${this.mediaPathPrefix}/${relativePath}`);
					});
				})
				.on("error", (error) => {
					console.log(error.message);
					console.log(error.code);
					console.log(error.stack);
					// 不報錯，回傳原始url
					resolve(url);
				});
		});
	}

	async getPageContent(page, selector) {
		await page.waitForSelector(selector);
		return page.evaluate(
			(selector) => ({
				html: document.querySelector(selector)?.outerHTML,
				mediaUrls: Array.from(
					document
						.querySelector(selector)
						?.querySelectorAll("img, video, source") || []
				)
					.map((el) => ({
						url: el.src || el.currentSrc,
						fileName: (el.src || el.currentSrc)
							?.split("/")
							?.pop()
							?.split("?")[0],
					}))
					.filter(({ url, fileName }) => url && fileName),
			}),
			selector
		);
	}

	async getStyles(page, selector) {
		await page.waitForFunction(() =>
			Array.from(document.styleSheets).every(
				(sheet) =>
					!sheet.href || document.querySelector(`link[href="${sheet.href}"]`)
			)
		);

		return page.evaluate((selector) => {
			const styles = new Set();
			const element = document.querySelector(selector);
			if (!element) return "";

			// 處理樣式表規則
			const processRule = (rule) => {
				if (
					rule instanceof CSSStyleRule &&
					element.matches(rule.selectorText)
				) {
					styles.add(rule.cssText);
				} else if (rule instanceof CSSMediaRule) {
					const mediaRules = Array.from(rule.cssRules)
						.filter(
							(r) =>
								r instanceof CSSStyleRule && element.matches(r.selectorText)
						)
						.map((r) => r.cssText)
						.join("\n");
					if (mediaRules) {
						styles.add(`@media ${rule.conditionText} {\n${mediaRules}\n}`);
					}
				}
			};

			// 收集所有樣式
			for (const sheet of document.styleSheets) {
				try {
					Array.from(sheet.cssRules || []).forEach(processRule);
				} catch (e) {
					console.warn(`無法讀取樣式表: ${sheet.href || "inline"}`);
				}
			}

			// 處理內聯樣式
			if (element.hasAttribute("style")) {
				styles.add(`${selector} { ${element.getAttribute("style")} }`);
			}

			// 處理計算後的樣式
			const computed = window.getComputedStyle(element);
			const computedRules = Array.from(computed)
				.filter((prop) => {
					const value = computed.getPropertyValue(prop);
					return value && value !== "initial" && value !== "none";
				})
				.map((prop) => `  ${prop}: ${computed.getPropertyValue(prop)};`)
				.join("\n");

			if (computedRules) {
				styles.add(`${selector} {\n${computedRules}\n}`);
			}

			return Array.from(styles).join("\n");
		}, selector);
	}

	async scrapeElement(selector, fileName = null, date = null) {
		const browser = await puppeteer.launch({
			headless: "new",
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		try {
			const page = await browser.newPage();
			await page.goto(this.baseUrl, {
				waitUntil: "networkidle0",
				timeout: 30000,
			});

			await this.initialize(date);

			const { html, mediaUrls } = await this.getPageContent(page, selector);
			if (!html) throw new Error(`元素未找到: ${selector}`);

			let processedHTML = html;
			for (const { url, fileName: mediaFileName } of mediaUrls) {
				const newPath = await this.downloadMedia(url, mediaFileName);
				processedHTML = processedHTML.replaceAll(url, newPath);
			}

			const styles = await this.getStyles(page, selector);
			const outputHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>${styles}</style>
</head>
<body>${processedHTML}</body>
</html>`;

			const outputFile = path.join(
				date ? path.join(this.outputPath.root, date) : this.outputPath.root,
				`${
					date ||
					`element_${selector.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}`
				}.html`
			);

			await fs.writeFile(outputFile, outputHTML);
			console.log(
				`已保存至: ${outputFile}\n媒體文件位置: ${this.outputPath.media}`
			);

			// 更新搜索索引
			try {
				const searchIndex = new SearchIndex();
				// 清理 HTML 標籤以獲得純文本內容
				const cleanContent = processedHTML
					.replace(/<[^>]*>/g, " ")
					.replace(/\s+/g, " ")
					.trim();

				await searchIndex.addEntry({
					date: date,
					title: fileName,
					content: cleanContent,
					url: `${date}/${date}.html`,
				});
				console.log("搜索索引已更新");
			} catch (indexError) {
				console.error("更新搜索索引時發生錯誤:", indexError);
				// 不要因為索引更新失敗而中斷整個流程
			}
		} catch (error) {
			console.error("錯誤:", error);
			throw error;
		} finally {
			await browser.close();
		}
	}
}

module.exports = WebScraper;
