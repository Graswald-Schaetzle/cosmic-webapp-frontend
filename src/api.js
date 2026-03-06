import {config} from "./config";

function crateMatterTag(title, description, coords, color) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "label": title,
        "description": description,
        "x": coords[0],
        "y": coords[1],
        "z": coords[2],
        "color": color,
        "enabled": true,
        "floorId": "tsmq1wak12rhgn0mawksxcwcd"
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    console.log('fetch')
    fetch(`${config.apiParams.url}/matter-tag`, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.error(error));
}
function deleteMatterTag(id) {
    const requestOptions = {
        method: "DELETE",
        redirect: "follow"
    };

    fetch(`${config.apiParams.url}/matter-tag/${id}`, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.error(error));
}


export const apiRequests = {
    crateMatterTag,
    deleteMatterTag
}
