require("dotenv").config();
const UrlManager = require("./src/url-manager");
const WebScraper = require("./src/scraper");

async function main() {
	try {
		const apiUrl = process.env.API_URL || "https://your-api-url.com";
		const className = process.env.CLASS_NAME || ".target-class-name";
		const manager = new UrlManager();

		// 獲取新的 URL
		console.log("正在檢查新的 URL...");
		const newUrls = await manager.getNewUrls(apiUrl);

		if (newUrls.length === 0) {
			console.log("沒有發現新的 URL");
			return;
		}

		console.log(`發現 ${newUrls.length} 個新的 URL`);

		// 依序處理每個 URL
		for (const { url, date, title } of newUrls) {
			console.log(`\n處理 URL: ${url}`);
			console.log(`日期: ${date}, 標題: ${title}`);
			const scraper = new WebScraper(url);

			try {
				await scraper.scrapeElement(className, title, date);
				console.log(`成功處理: ${url}`);
			} catch (error) {
				console.error(`處理 ${url} 時發生錯誤:`, error);
				// 繼續處理下一個 URL
				continue;
			}
		}

		console.log("\n所有 URL 處理完成");
	} catch (error) {
		console.error("程式執行錯誤:", error);
	}
}

// 執行主程式
main().catch(console.error);
