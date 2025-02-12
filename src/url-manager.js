const fs = require("fs").promises;
const path = require("path");
const https = require("https");

class UrlManager {
	constructor(dictionaryPath = "./url_dictionary.json") {
		this.dictionaryPath = dictionaryPath;
		this.dictionary = new Set();
	}

	async loadDictionary() {
		try {
			const data = await fs.readFile(this.dictionaryPath, "utf8");
			this.dictionary = new Set(JSON.parse(data));
		} catch (error) {
			if (error.code === "ENOENT") {
				// 如果字典文件不存在，創建一個空的
				await this.saveDictionary();
			} else {
				throw error;
			}
		}
	}

	async saveDictionary() {
		await fs.writeFile(
			this.dictionaryPath,
			JSON.stringify(Array.from(this.dictionary), null, 2)
		);
	}

	async fetchUrls(apiUrl) {
		return new Promise((resolve, reject) => {
			https
				.get(apiUrl, (response) => {
					let data = "";
					response.on("data", (chunk) => (data += chunk));
					response.on("end", () => {
						try {
							const jsonData = JSON.parse(data);
							resolve(jsonData);
						} catch (error) {
							reject(error);
						}
					});
				})
				.on("error", reject);
		});
	}

	async getNewUrls(apiUrl) {
		await this.loadDictionary();

		const jsonData = await this.fetchUrls(apiUrl);
		const urlsWithInfo = jsonData.topics.map((topic) => ({
			url: topic?.url,
			date: topic?.date,
			title: topic?.title,
		}));

		// 找出新的 URL
		const newUrls = urlsWithInfo.filter(
			(item) => !this.dictionary.has(item.url)
		);

		// 將所有 URL 加入字典
		urlsWithInfo.forEach((item) => this.dictionary.add(item.url));
		await this.saveDictionary();

		return newUrls.reverse();
	}
}

module.exports = UrlManager;

/* 使用範例：
const manager = new UrlManager();
manager.getNewUrls('https://example.com/api/urls')
    .then(newUrls => {
        console.log('新的 URL:', newUrls);
    })
    .catch(console.error);
*/
