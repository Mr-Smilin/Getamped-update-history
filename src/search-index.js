const fs = require("fs").promises;
const path = require("path");

class SearchIndex {
	constructor(indexPath = "./search_index.json") {
		this.indexPath = indexPath;
		this.index = [];
	}

	async loadIndex() {
		try {
			const data = await fs.readFile(this.indexPath, "utf8");
			this.index = JSON.parse(data);
		} catch (error) {
			if (error.code === "ENOENT") {
				await this.saveIndex();
			} else {
				throw error;
			}
		}
	}

	async saveIndex() {
		await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
	}

	async addEntry(entry) {
		await this.loadIndex();
		const existingIndex = this.index.findIndex(
			(item) => item.date === entry.date
		);

		if (existingIndex !== -1) {
			this.index[existingIndex] = entry;
		} else {
			this.index.push(entry);
		}

		// 根據日期降序排序
		this.index.sort((a, b) => new Date(b.date) - new Date(a.date));
		await this.saveIndex();
	}

	async search(query) {
		await this.loadIndex();
		if (!query) return this.index;

		const keywords = query
			.toLowerCase()
			.split(" ")
			.filter((k) => k);
		return this.index.filter((entry) => {
			return keywords.every(
				(keyword) =>
					entry.title.toLowerCase().includes(keyword) ||
					entry.content.toLowerCase().includes(keyword)
			);
		});
	}

	async getPage(page = 1, perPage = 10) {
		await this.loadIndex();
		const start = (page - 1) * perPage;
		const end = start + perPage;
		return {
			total: this.index.length,
			totalPages: Math.ceil(this.index.length / perPage),
			currentPage: page,
			perPage,
			data: this.index.slice(start, end),
		};
	}
}

module.exports = SearchIndex;
