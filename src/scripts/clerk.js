import { Clerk } from '@clerk/clerk-js';
import {initMatterport} from "./matterport";
import {htmlMarkup} from "./html-markup";
import {initMenu} from "./menu";
import {authorizeUser} from "./api";

const clerkFrontendApi = 'pk_test_aW5maW5pdGUtc3dpZnQtODQuY2xlcmsuYWNjb3VudHMuZGV2JA';
const clerk = new Clerk(clerkFrontendApi);

async function initClerk() {
    await clerk.load();
    console.log('Clerk loaded', clerk);


    if (clerk.user) {

        clerk.mountUserButton(htmlMarkup.clerk.userButton, {
            afterSignOutUrl:  window.location.pathname,
        });
        htmlMarkup.clerk.signInModal.classList.add('hidden');
        initMatterport();
        // initMenu();
        authorizeUser(clerk.user)
    } else {

        clerk.mountSignIn(htmlMarkup.clerk.signInModal, {
            signInOptions: {
                socialConnections: ['google', 'apple'],
            },
            afterSignInUrl:  window.location.pathname,
            afterSignUpUrl: window.location.pathname,
        });
        htmlMarkup.clerk.userButton.classList.add('hidden');
    }
}
initClerk();
