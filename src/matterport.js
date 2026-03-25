import { connect } from 'https://api.matterport.com/sdk/bootstrap/3.0.0-0-g0517b8d76c/sdk.es6.js?applicationKey=2m09afwdgxp3g0dgdr8zn193a';
import {config} from "./config";
import {htmlMarkup} from "./scripts/html-markup";

export async function initMatterport() {
    const mpSdk = await connect(htmlMarkup.commonElements.matterportIframe);
    config.matterport.sdk = mpSdk;
    setBaseSubscription(mpSdk).then(() => {
        createTaskButtonControl()
    });


    async function setBaseSubscription(mpSdk) {
        console.log('SDK obj: ', mpSdk);
        const modelData = await mpSdk.Model.getData();
        console.log('Model data:' + modelData);

        mpSdk.Camera.pose.subscribe(function(pose) {
            config.matterport.poseCache = pose;
        });

        mpSdk.Pointer.intersection.subscribe(function(intersection) {
            // console.log(intersection);
            config.matterport.intersectionCache = intersection;
            config.matterport.intersectionCache.time = new Date().getTime();
            htmlMarkup.commonElements.createTaskButton.style.display = 'none';
            config.matterport.showCrateTaskButton = false;
            config.task.coords = intersection.position;
        });

        // for test, log all mattertags
        mpSdk.Mattertag.getData().then(function(mattertags) {
            console.log('Mattertags arr: ', mattertags);
        });
    }

    function createTaskButtonControl() {
        const delayBeforeShow = 500;
        const { sdk } = config.matterport;
        const {  createTaskButton } = htmlMarkup.commonElements
        setInterval(() => {
            const { intersectionCache, poseCache} = config.matterport;
            if (!intersectionCache || !poseCache) {
                return;
            }

            const nextShow = intersectionCache.time + delayBeforeShow;
            if (new Date().getTime() > nextShow) {
                if (config.matterport.showCrateTaskButton) {
                    return;
                }

                const size = {
                    w: htmlMarkup.commonElements.matterportIframe.clientWidth,
                    h: htmlMarkup.commonElements.matterportIframe.clientHeight,
                };
                const coords = sdk.Conversion.worldToScreen(intersectionCache.position, poseCache, size);
                createTaskButton.style.left = `${coords.x - 25}px`;
                createTaskButton.style.top = `${coords.y - 22}px`;
                // createTaskButton.style.display = 'block';
                // config.matterport.showCrateTaskButton = true;

                sdk.Renderer.getScreenPosition(intersectionCache.position).then((screenPosition) => {
                    // console.log('screenPosition:', screenPosition);
                });
            }
        }, 16);
    }
}
