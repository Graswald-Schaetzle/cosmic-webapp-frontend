import {config} from "./config";
import {createMenu} from "./menu";

function authorizeUser(clerkUser) {
    console.log('clerkUser', clerkUser)

    const user = {
        first_name: clerkUser.firstName || '',
        last_name: clerkUser.lastName || '',
        email: clerkUser.emailAddresses[0].emailAddress || '',
        clerk_id: clerkUser.id || '',
        role: 'user',
        username: clerkUser.fullName.replace(/\s/g, '') || '',
    }


    const raw = JSON.stringify(user);

    const requestOptions = {
        method: "POST",
        headers: {  "Content-Type": "application/json" },
        body: raw,
        redirect: "follow"
    };

    fetch(`${config.apiParams.url}/auth/signup`, requestOptions)
        .then((response) => response.text())
        .then((result) => {
            console.log('result', result)
            const data = JSON.parse(result);
            console.log('data', data, data.user, data.user.access_token)
            if (data.user && data.user.access_token) {
                config.apiParams.accessToken = data.user.access_token
                console.log('Access token:', config.apiParams.accessToken);
                getUserMenu();
            }
        })
        .catch((error) => console.error(error));
}

function getUserMenu() {
    const requestOptions = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiParams.accessToken}`,
        },
        redirect: "follow"
    };

    fetch(`${config.apiParams.url}/user-menu`, requestOptions)
        .then((response) => response.text())
        .then((result) => {
            const data = JSON.parse(result);
            createMenu(data.data)
        })
        .catch((error) => console.error(error));
}
function updateUserMenu(newList) {
    const requestOptions = {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiParams.accessToken}`,
        },
        body: JSON.stringify(newList),
        redirect: "follow"
    };
    console.log('newList', newList)

    fetch(`${config.apiParams.url}/user-menu/`, requestOptions)
        .then((response) => response.text())
        .then((result) => {
            console.log('result', result)
            config.menu.requestIsSending = false
        })
        .catch((error) => console.error(error));
}


export  {
    authorizeUser,
    updateUserMenu
}
