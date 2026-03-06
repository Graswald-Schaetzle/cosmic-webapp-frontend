const matterport = {
    sdk: null,
    showCrateTaskButton: false,
    poseCache: null,
    intersectionCache: null,
}


const task = {
    mode: 'create', // create or edit
    coords: {x: null, y: null, z: null},
    id: null,
    title: '',
    description: '',
    date: '',
    priority: '',
}

const apiParams = {
    url: 'https://cosmic-be-dp7k.onrender.com',
}

export const config = {
    matterport,
    task,
    apiParams
}
