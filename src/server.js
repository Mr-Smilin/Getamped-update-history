const express = require("express");
const path = require("path");
const SearchIndex = require("./search-index");

const app = express();
const port = process.env.PORT || 3000;
const searchIndex = new SearchIndex();

// 靜態文件服務
app.use(express.static("output"));

// API 端點
app.get("/api/articles", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const perPage = parseInt(req.query.perPage) || 10;
		const query = req.query.q || "";

		let results;
		if (query) {
			const searchResults = await searchIndex.search(query);
			const start = (page - 1) * perPage;
			const end = start + perPage;
			results = {
				data: searchResults.slice(start, end),
				total: searchResults.length,
				totalPages: Math.ceil(searchResults.length / perPage),
				currentPage: page,
				perPage,
			};
		} else {
			results = await searchIndex.getPage(page, perPage);
		}

		res.json(results);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// 提供入口頁面
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
