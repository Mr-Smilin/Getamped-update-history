const fs = require("fs").promises;
const path = require("path");
const SearchIndex = require("./search-index");

class StaticGenerator {
	constructor(
		sourcePath = "./output",
		buildPath = "./output_static",
		media_path = ""
	) {
		this.sourcePath = sourcePath; // 原始檔案位置
		this.buildPath = buildPath; // 靜態網站輸出位置
		this.media_path = !!media_path ? "/" + media_path : "";
		this.searchIndex = new SearchIndex();
	}

	async generateStaticFiles() {
		console.log("開始生成靜態網站...");

		// 1. 確保建立新的輸出目錄
		await fs.mkdir(this.buildPath, { recursive: true });
		console.log("建立輸出目錄完成");

		// 2. 複製原始檔案到新目錄
		await this.copyOriginalFiles();
		console.log("複製原始檔案完成");

		// 3. 載入索引數據
		await this.searchIndex.loadIndex();
		const allArticles = this.searchIndex.index;
		console.log(`載入了 ${allArticles.length} 篇文章的索引`);

		// 4. 在新目錄中生成靜態文件
		await this.generatePaginatedPages(allArticles);
		console.log("生成分頁完成");

		await this.generateSearchScript(allArticles);
		console.log("生成搜尋腳本完成");

		await this.copyStaticAssets();
		console.log("複製靜態資源完成");
	}

	async copyOriginalFiles() {
		const copyDir = async (src, dest) => {
			const entries = await fs.readdir(src, { withFileTypes: true });

			for (const entry of entries) {
				const srcPath = path.join(src, entry.name);
				const destPath = path.join(dest, entry.name);

				if (entry.isDirectory()) {
					await fs.mkdir(destPath, { recursive: true });
					await copyDir(srcPath, destPath);
				} else {
					await fs.copyFile(srcPath, destPath);
				}
			}
		};

		await copyDir(this.sourcePath, this.buildPath);
	}

	async generatePaginatedPages(articles) {
		const perPageOptions = [10, 20, 50];
		const defaultPerPage = 10;

		// 為每個分頁選項生成頁面
		for (const perPage of perPageOptions) {
			const totalPages = Math.ceil(articles.length / perPage);

			for (let page = 1; page <= totalPages; page++) {
				const start = (page - 1) * perPage;
				const end = start + perPage;
				const pageArticles = articles.slice(start, end);

				const pageHtml = this.generatePageHtml({
					articles: pageArticles,
					currentPage: page,
					totalPages,
					perPage,
					totalArticles: articles.length,
				});

				const pageDir =
					page === 1 && perPage === defaultPerPage
						? this.buildPath
						: path.join(this.buildPath, `page/${perPage}/${page}`);

				await fs.mkdir(pageDir, { recursive: true });
				await fs.writeFile(path.join(pageDir, "index.html"), pageHtml);
			}
		}
	}

	generatePageHtml({
		articles,
		currentPage,
		totalPages,
		perPage,
		totalArticles,
	}) {
		const articlesHtml = articles
			.map(
				(article) => `
            <div class="article">
                <a href="${this.media_path}/${article.date}/${article.date}.html">${article.title}</a>
                <div class="date">${article.date}</div>
            </div>
        `
			)
			.join("");

		return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GA 更新資訊</title>
    <link rel="stylesheet" href="${this.media_path}/styles.css">
</head>
<body>
    <div class="controls">
        <input type="text" id="search" class="search-box" 
               placeholder="搜尋標題或內容 (可用空格分隔多個關鍵字)">
        <label>
            每頁顯示：
            <select id="perPage" class="per-page">
                <option value="10" ${
									perPage === 10 ? "selected" : ""
								}>10</option>
                <option value="20" ${
									perPage === 20 ? "selected" : ""
								}>20</option>
                <option value="50" ${
									perPage === 50 ? "selected" : ""
								}>50</option>
            </select>
        </label>
    </div>

    <div class="articles" id="articleList">
        ${articlesHtml}
    </div>

    <div class="pagination">
        ${this.generatePaginationHtml(currentPage, totalPages, perPage)}
    </div>

    <script src="${this.media_path}/search.js"></script>
    <script>
        document.getElementById('perPage').addEventListener('change', (e) => {
            const perPage = e.target.value;
            window.location.href = perPage === '10' 
                ? '${this.media_path}' 
                : '${this.media_path}' + '/page/' + perPage + '/1';
        });
    </script>
</body>
</html>`;
	}

	generatePaginationHtml(currentPage, totalPages, perPage) {
		// const basePath = perPage === 10 ? "" : `/page/${perPage}`;
		const basePath = `${this.media_path}/page/${perPage}`;
		const prevPage =
			currentPage > 1
				? currentPage === 2 && perPage === 10
					? "/"
					: `${basePath}/${currentPage - 1}`
				: null;
		const nextPage =
			currentPage < totalPages ? `${basePath}/${currentPage + 1}` : null;

		return `
            <button onclick="window.location.href='${prevPage}'" 
                    ${!prevPage ? "disabled" : ""}>上一頁</button>
            <span>第 ${currentPage} 頁，共 ${totalPages} 頁</span>
            <button onclick="window.location.href='${nextPage}'"
                    ${!nextPage ? "disabled" : ""}>下一頁</button>
        `;
	}

	async generateSearchScript(articles) {
		const searchJs = `
const articleData = ${JSON.stringify(articles)};
const prefixPath = '${this.media_path}';

function search(query) {
    if (!query) return articleData;
    
    const keywords = query.toLowerCase().split(' ').filter(k => k);
    return articleData.filter(entry => 
        keywords.every(keyword =>
            entry.title.toLowerCase().includes(keyword) ||
            entry.content.toLowerCase().includes(keyword)
        )
    );
}

document.getElementById('search').addEventListener('input', (e) => {
    const query = e.target.value;
    const results = search(query);
    
    const container = document.getElementById('articleList');
    container.innerHTML = results.map(article => \`
        <div class="article">
            <a href="${prefixPath}/\${article.date}/\${article.date}.html">\${article.title}</a>
            <div class="date">\${article.date}</div>
        </div>
    \`).join('');
});`;

		await fs.writeFile(path.join(this.buildPath, "search.js"), searchJs);
	}

	async copyStaticAssets() {
		const css = `
body {
    font-family: Arial, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f5f5f5;
}
.controls {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.search-box {
    box-sizing: border-box;
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
}
.per-page {
    padding: 5px;
    margin-left: 10px;
}
.articles {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.article {
    padding: 15px;
    border-bottom: 1px solid #eee;
}
.article:last-child {
    border-bottom: none;
}
.article a {
    color: #2c3e50;
    text-decoration: none;
    font-size: 1.1em;
}
.article a:hover {
    color: #3498db;
}
.date {
    color: #7f8c8d;
    font-size: 0.9em;
    margin-top: 5px;
}
.pagination {
    margin-top: 20px;
    text-align: center;
}
.pagination button {
    padding: 5px 15px;
    margin: 0 5px;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    border-radius: 4px;
}
.pagination button:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
}
.pagination span {
    margin: 0 10px;
}`;

		await fs.writeFile(path.join(this.buildPath, "styles.css"), css);
	}
}

module.exports = StaticGenerator;
