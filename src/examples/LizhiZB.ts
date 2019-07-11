import {
    AddToQueue, appInfo, DbHelperUi, FileUtil,
    FromQueue,
    Job,
    Launcher,
    logger,
    OnStart,
    Page, PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory, RequestUtil
} from "ppspider";

class LizhiZBTask{

    @OnStart({
        urls:"https://lizhizhuangbi.bandcamp.com/music"
    })
    @AddToQueue([
        {
            name:"music_lizhi_list"
        }
    ])
    async roaming(page: Page,job: Job){
        // debugger;
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page,false);
        await page.goto(job.url);
        return PuppeteerUtil.links(page, {
            "music_lizhi_list":"https://lizhizhuangbi.bandcamp.com/album/.*"
        })
    }

    // @OnStart({
    //     urls:"https://lizhizhuangbi.bandcamp.com/album/--2"
    // })
    @FromQueue({name:"music_lizhi_list",parallel:1,exeInterval:1000})
    async list (page:Page, job: Job){
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page,false);
        await page.goto(job.url, {waitUntil: "networkidle2"});
        await PuppeteerUtil.addJquery(page);
        let albums = await page.evaluate(() => {
            let albums  ={
                _id: $("h2.trackTitle").text().trim(),
                musics: []
            };
            $("#track_table tr").each((trI,tr)=>{
                $(tr).find("td.play-col a[role='button']").attr("id", "btn" + trI);
                let name =$(tr).find("span.track-title").text().trim();
                albums.musics.push({
                    btnId: "btn" + trI,
                    name
                });
            });
            return albums;
        });
        for (let i = 0, len = albums.musics.length; i < len; i++) {
            await page.tap("#" + albums.musics[i].btnId);
            albums.musics[i].url = await page.evaluate(() => $("audio").attr("src"));
            delete albums.musics[i].btnId;
            const downloadRes = await RequestUtil.simple({
                url: albums.musics[i].url,
                headerLines: `
                    Accept-Encoding: identity;q=1, *;q=0
                    Range: bytes=0-
                    Referer: https://lizhizhuangbi.bandcamp.com/
                    User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36
                `
            });
            FileUtil.write(appInfo.workplace + "/musics/" + albums.musics[i].name + ".mp3", downloadRes.body);
        }
        await appInfo.db.save("albums", albums);
    }

}


@Launcher({
    workplace: "lizhi_music",
    tasks:[
        LizhiZBTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys:[
        new PuppeteerWorkerFactory({
            headless:false,
            devtools:true
        })
    ]
})
class LizhiZBApp{

}