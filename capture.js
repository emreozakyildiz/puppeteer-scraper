const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FRAMES_DIR = './frames';
const FRAME_COUNT = 120;
const VIEWPORT = { width: 800, height: 600 };

(async () => {
    if (!fs.existsSync(FRAMES_DIR)) {
        fs.mkdirSync(FRAMES_DIR);
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.goto('file://' + path.resolve('./ash.html'));

    for (let i = 0; i < FRAME_COUNT; i++) {
        await page.waitForTimeout(50); // ~20 FPS
        const filename = `${FRAMES_DIR}/frame_${i.toString().padStart(3, '0')}.png`;
        await page.screenshot({ path: filename });
        console.log(`Saved: ${filename}`);
    }

    await browser.close();
    console.log("Done capturing frames.");
})();
