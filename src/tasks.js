import {config} from "./config";
import {createFrameHTML} from "./utils";
import {htmlMarkup} from "./scripts/html-markup";
import {apiRequests} from "./api";

export function initTasks() {

    setListeners();
    function setListeners() {
        const {matterportIframe, createTaskButton, tagControlContainer, tagControlContainerBg} = htmlMarkup.commonElements

        createTaskButton.addEventListener('click', () => {
            console.log('clicked coords:', config.task.coords);
            tagControlContainer.classList.add('show');
        });
        tagControlContainerBg.addEventListener('click', () => {
            tagControlContainer.classList.remove('show');
        })

        // form
        const titleWindow = document.querySelector('.tag-control-container h2');
        const titleInput = document.querySelector('.tag-control-container .task-title');
        const descriptionInput = document.querySelector('.tag-control-container .task-description');
        const dateInput = document.querySelector('.tag-control-container .task-date');
        const priorityInput = document.querySelector('.tag-control-container .task-priority');
        const createButton = document.querySelector('.tag-control-container button');

        const relations = [
            { input: titleInput, key: 'title' },
            { input: descriptionInput, key: 'description' },
            { input: dateInput, key: 'date' },
            { input: priorityInput, key: 'priority' },
        ]
        relations.forEach(({ input, key }) => {
            input.addEventListener('input', (e) => {
                config.task[key] = e.target.value;
            });
        });
        createTaskButton.addEventListener('click', () => {
            relations.forEach(({ input, key }) => {
                input.value = '';
            });
            config.task.mode = 'create';
            titleWindow.innerText = 'Create Task';
            createButton.innerText = 'Create';
        });

        createButton.addEventListener('click', () => {
            console.log('create task:', config.task);

            const description = `Description: ${config.task.description}\n\nDate: ${config.task.date}\n\nPriority: ${config.task.priority}`;

            if (config.task.mode === 'create') {
                config.task.coords.y += 0.5
                const mattertags = [{
                    label: config.task.title,
                    description,
                    anchorPosition: config.task.coords,
                    stemVector: {x: 0, y: 0, z: 0},
                    color: {r: 0.9, g: 0, b: 0},
                }];

                config.matterport.sdk.Mattertag.add(mattertags).then(function (mattertagIds) {
                    console.log(mattertagIds);

                    // add html
                    const html = createFrameHTML(mattertagIds[0], 'op1')


                    config.matterport.sdk.Mattertag.injectHTML(mattertagIds[0], html).then((res) => {
                        console.log('injectHTML:', res);
                    })

                    tagControlContainer.classList.remove('show');
                    createTaskButton.style.display = 'none';
                    matterportIframe.focus();

                    // test
                    config.matterport.sdk.Mattertag.getData().then(function (mattertags) {
                        console.log('Mattertags arr: ', mattertags);
                    });

                });

                apiRequests.crateMatterTag(
                    config.task.title,
                    // config.task.description,
                    description,
                    [ config.task.coords.x, config.task.coords.y, config.task.coords.z ],
                    '#ff0000'
                )
            }
            if (config.task.mode === 'edit') {
                config.matterport.sdk.Tag.editBillboard(config.task.id, {
                    label: config.task.title,
                    description,
                });

                tagControlContainer.classList.remove('show');
                createTaskButton.style.display = 'none';
                matterportIframe.focus();
            }
        })


        window.addEventListener("message", function (event) {
            // console.log('message:', event);
            if (event && event.data && event.data.payload && event.data.payload.messageType === 'sandbox.to.client') {
                console.log('message2:', event.data.payload);
                const messagePayload = event.data.payload.messagePayload


                if (messagePayload.type === "select-changed") {
                    const [tagId, selectValue] = messagePayload.payload

                    const html = createFrameHTML(tagId, selectValue)
                    config.matterport.sdk.Mattertag.injectHTML(tagId, html)

                    let color = null
                    switch (selectValue) {
                        case 'op1':
                            color = {r: 0.9, g: 0, b: 0}
                            break
                        case 'op2':
                            color = {r: 0.1, g: 0.1, b: 0.9}
                            break
                        case 'op3':
                            color = {r: 0.1, g: 0.9, b: 0.1}
                    }
                    config.matterport.sdk.Tag.editColor(tagId, color)
                }

                if (messagePayload.type === "edit-tag") {
                    const [tagId] = messagePayload.payload
                    console.log('edit', tagId);

                    tagControlContainer.classList.add('show');
                    config.task.mode = 'edit';
                    titleWindow.innerText = 'Edit Task';
                    createButton.innerText = 'Save';

                    console.log('data', config.matterport.sdk.Tag.data)

                    config.matterport.sdk.Mattertag.getData().then(function(mattertags) {
                        const tagData = mattertags.find(tag => tag.sid === tagId);
                        console.log('tagData:', tagData);
                        if (tagData) {
                            const objData = tagData.description.split("\n\n").reduce((acc, line) => {
                                const [key, value] = line.split(": ");
                                acc[key.trim()] = value ? value.trim() : "";
                                return acc;
                            }, {});
                            console.log('objData', objData)
                            titleInput.value = tagData.label;
                            descriptionInput.value = objData["Description"];
                            dateInput.value = objData["Date"];
                            priorityInput.value = objData["Priority"];

                            config.task.title = tagData.label;
                            config.task.description = objData["Description"];
                            config.task.date = objData["Date"];
                            config.task.priority = objData["Priority"];
                            config.task.id = tagId;
                        }

                    });


                    // titleInput.value = tagData.label;
                    // descriptionInput.value = tagData.description;
                    // dateInput.value = tagData.date;
                    // priorityInput.value = tagData.priority;
                    //
                    // config.task.coords = tagData.anchorPosition

                    // titleInput = document.querySelector('.tag-control-container .task-title');
                    // descriptionInput = document.querySelector('.tag-control-container .task-description');
                    // dateInput = document.querySelector('.tag-control-container .task-date');
                    // priorityInput = document.querySelector('.tag-control-container .task-priority');

                }
                if (messagePayload.type === "delete-tag") {
                    const [tagId] = messagePayload.payload
                    config.matterport.sdk.Tag.remove(tagId).then((res) => {
                        console.log('Tag was deleted:', res);
                    })
                    // apiRequests.deleteMatterTag(tagId)
                }
            }
        });

    }
}
