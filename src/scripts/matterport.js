import {htmlMarkup} from "./html-markup";
import {connect} from 'https://api.matterport.com/sdk/bootstrap/3.0.0-0-g0517b8d76c/sdk.es6.js?applicationKey=2m09afwdgxp3g0dgdr8zn193a';
import {config} from "../config";


async function initMatterport() {
    initMatterportFrame().then(() => {
        setBaseSubscription(config.matterport.sdk)
    })

}
async function initMatterportFrame() {
    htmlMarkup.commonElements.matterportIframe.src = `https://my.matterport.com/show?m=7fLAd3tVW8q&play=1&applicationKey=2m09afwdgxp3g0dgdr8zn193a&search=0&title=0`
    config.matterport.sdk = await connect(htmlMarkup.commonElements.matterportIframe);
}

async function setBaseSubscription(mpSdk) {
    console.log('SDK obj: ', mpSdk);
    const modelData = await mpSdk.Model.getData();
    console.log('Model data:' + modelData);


    mpSdk.Mattertag.getData().then(function(mattertags) {
        console.log('Mattertags arr: ', mattertags);

        mattertags.forEach((mattertag) => {
            config.matterport.mattertags = mattertags;

            config.matterport.sdk.Tag.allowAction(mattertag.sid, {
                opening: false,
                navigating: false,
            })
        })
    });

    config.matterport.sdk.Tag.openTags.subscribe({
        prevState: {
            hovered: null,
            docked: null,
            selected: null,
        },
        onChanged(newState) {
            if (newState.hovered !== this.prevState.hovered) {
                if (newState.hovered) {
                    console.log(newState.hovered, 'was hovered');
                    // config.tagInteraction.hovered = true;
                    // config.tagInteraction.hoveredTag = newState.hovered;
                } else {
                    console.log(this.prevState.hovered, 'is no longer hovered');
                    // config.tagInteraction.hovered = false;
                    // config.tagInteraction.hoveredTag = null;
                }
            }
            if (newState.docked !== this.prevState.docked) {
                if (newState.docked) {
                    console.log(newState.docked, 'was docked');
                } else {
                    console.log(this.prevState.docked, 'was undocked');
                }
            }

            // only compare the first 'selected' since only one tag is currently supported
            const [selected = null] = newState.selected; // destructure and coerce the first Set element to null
            if (selected !== this.prevState.selected) {
                if (selected) {
                    console.log(selected, 'was selected');
                    openTag(selected);
                } else {
                    console.log(this.prevState.selected, 'was deselected');
                    // config.tagInteraction.selected = false;
                }
            }

            // clone and store the new state
            this.prevState = {
                ...newState,
                selected,
            };
        },
    });
}
function openTag(id) {
    const tag = config.matterport.mattertags.find((tag) => tag.sid === id);
    console.log('openTag: ', tag);

    const bg = document.querySelector('#mattertag-container #screen-bg')
    const popUp = document.querySelector('#mattertag-popup')
    bg.classList.add('show');
    popUp.classList.add('show');

    // fill pop up with data

    const allTasks = htmlMarkup.matterportUI.mattartagPopUp.querySelectorAll('.task-container .item');
    allTasks.forEach((task) => {
        task.addEventListener('click', () => {
            htmlMarkup.matterportUI.mattartagPopUp.classList.remove('show');
            htmlMarkup.matterportUI.taskPopUp.classList.add('show');
        })
    })

}

function initPopUpListeners() {
    console.log('initPopUpListeners',  htmlMarkup.matterportUI)
    htmlMarkup.matterportUI.objectButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.mattartagPopUp.classList.remove('selected-documents');
        htmlMarkup.matterportUI.mattartagPopUp.classList.add('selected-object');
    })
    htmlMarkup.matterportUI.documentsButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.mattartagPopUp.classList.remove('selected-object');
        htmlMarkup.matterportUI.mattartagPopUp.classList.add('selected-documents');
    })
    htmlMarkup.matterportUI.background.addEventListener('click', () => {
        htmlMarkup.matterportUI.background.classList.remove('show');
        htmlMarkup.matterportUI.mattartagPopUp.classList.remove('show');
        htmlMarkup.matterportUI.taskPopUp.classList.remove('show');
    })

    // task
    htmlMarkup.matterportUI.taskBackButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.taskPopUp.classList.remove('show')
        htmlMarkup.matterportUI.mattartagPopUp.classList.add('show');
    })
    htmlMarkup.matterportUI.taskEditButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.taskPopUp.classList.remove('show')
        htmlMarkup.matterportUI.editTaskPopUp.classList.add('show');
    })

    //
    htmlMarkup.matterportUI.editTaskBackButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.editTaskPopUp.classList.remove('show');
        htmlMarkup.matterportUI.taskPopUp.classList.add('show')
    })
    htmlMarkup.matterportUI.editTaskEditButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.editTaskPopUp.classList.remove('show');
        htmlMarkup.matterportUI.taskPopUp.classList.add('show')
    })
    htmlMarkup.matterportUI.editTaskCancelButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.editTaskPopUp.classList.remove('show');
        htmlMarkup.matterportUI.taskPopUp.classList.add('show')
    })
    htmlMarkup.matterportUI.editTaskSaveButton.addEventListener('click', () => {
        htmlMarkup.matterportUI.editTaskPopUp.classList.remove('show');
        htmlMarkup.matterportUI.taskPopUp.classList.add('show')
    })
}


export  {
    initMatterport,
    initPopUpListeners
}
