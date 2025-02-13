const StaticGenerator = require("./src/static-generator");

async function build() {
	console.log("開始生成靜態網站...");
	const generator = new StaticGenerator();

	try {
		generator
			.generateStaticFiles()
			.then(() => console.log("完成！"))
			.catch(console.error);
		console.log("靜態網站生成完成！");
	} catch (error) {
		console.error("生成過程中發生錯誤:", error);
		process.exit(1);
	}
}

build();
