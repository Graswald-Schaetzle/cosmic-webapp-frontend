import {updateUserMenu} from "./api";
import {config} from "./config";

function initMenu() {
    document.querySelector('#menu-container ').classList.add('show')

    const listItems = document.querySelectorAll('#menu-container .item');

    function handleUpdatingPositions() {
        const list1Items = Array.from(document.querySelectorAll('#list1 .item')).map(el => el.textContent.trim());
        const list2Items = Array.from(document.querySelectorAll('#list2 .item')).map(el => el.textContent.trim());

        console.log('Поточний порядок:');
        console.log('Колонка 1:', list1Items);
        console.log('Колонка 2:', list2Items);

        createUpdatedList(list1Items, list2Items);

        listItems.forEach(item => {
            if (item.classList.contains('selected')) {
                if (item.closest('.block-2')) {
                    item.classList.remove('selected');
                }
            }
        })
    }

    const options = {
        group: 'shared',
        animation: 150,
        onSort: handleUpdatingPositions,
        // onAdd: handleUpdatingPositions,
    };

    const list1 = new Sortable(document.getElementById('list1'), options);
    const list2 = new Sortable(document.getElementById('list2'), options);
    list1.option("disabled", true);


    // handleUpdatingPositions();


    document.querySelector('.block-1 .add-elem').addEventListener('click', function() {
        document.querySelector('#menu-container').classList.toggle('wide');
        const draggable = document.querySelector('#menu-container').classList.contains('wide')
        list1.option("disabled", !draggable);
    });
    document.querySelector('.block-2 .close-list-2').addEventListener('click', function() {
        document.querySelector('#menu-container').classList.remove('wide');
        list1.option("disabled", true);
    });


    listItems.forEach(clickedItem => {
        clickedItem.addEventListener('click', function() {
            if (clickedItem.classList.contains('add-elem'))  return

            const relevantPopup = findRelevantPopUp(clickedItem);
            if (relevantPopup) {
                relevantPopup.classList.toggle('show');
            }


            listItems.forEach(item => {
               if (item === clickedItem) {
                   item.classList.toggle('selected');

               } else {
                   item.classList.remove('selected');
               }
            })
        });
    })
}

function createMenu(menuList) {
    console.log('menuList', menuList)
    const enabledList = menuList.filter(item => item.enabled).sort((a, b) => a.order - b.order);
    const disabledList = menuList.filter(item => !item.enabled).sort((a, b) => a.order - b.order);

    console.log('enabledList', enabledList)
    console.log('disabledList', disabledList)
    const list1HTML = document.querySelector('#list1');
    const list2HTML = document.querySelector('#list2');
    let list1HTMLContent = '';
    let list2HTMLContent = '';
    enabledList.forEach(item => {
        if (item.name === 'AI Agent') return
        list1HTMLContent += ` <div class="item"><img src="${getSVG(item.name)}" alt=""><p>${item.name}</p></div>`
    })
    disabledList.forEach(item => {
        if (item.name === 'AI Agent') return
        list2HTMLContent += ` <div class="item"><img src="${getSVG(item.name)}" alt=""><p>${item.name}</p></div>`
    })
    list1HTML.innerHTML = list1HTMLContent;
    list2HTML.innerHTML = list2HTMLContent;

    initMenu()

    function getSVG(itemName) {
        const fileName = itemName.toLowerCase().replace(/ /g, '-');
        return `./icons/menu/white/${fileName}.svg`
    }
}
function createUpdatedList(list1Items, list2Items) {
    const list1ItemsPrettified = list1Items.map((item, index) => {return { name: item,  order: index, enabled: true}});
    const list2ItemsPrettified = list2Items.map((item, index) => {return { name: item,  order: index, enabled: false}});
    const unionList = [...list1ItemsPrettified, ...list2ItemsPrettified];
    if (unionList !== config.menu.previousList) {
        if (!config.menu.requestIsSending) {
            config.menu.requestIsSending = true;
            config.menu.previousList = unionList;
            updateUserMenu(unionList)
        } else {
            if (config.menu.requestInOrder) {
                clearInterval(config.menu.requestInOrder);
            }
            config.menu.requestInOrder = setInterval(() => {
                if (!config.menu.requestIsSending) {
                    clearInterval(config.menu.requestInOrder);
                    config.menu.requestIsSending = true;
                    config.menu.previousList = unionList;
                    updateUserMenu(unionList)
                }
            }, 200)
        }
    }
}

function findRelevantPopUp(menuItem) {
    const name = menuItem.querySelector('p').textContent.trim().toLowerCase();
    console.log('name', name)

    let foundedPopUp = null
    switch(name) {
        case 'dashboard':
            foundedPopUp = document.querySelector('#dashboard-popup')
            break
        default:

    }

    return foundedPopUp
}

export {
    initMenu,
    createMenu
};
