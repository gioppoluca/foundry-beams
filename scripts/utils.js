
export const cMATT = "monks-active-tiles";


export function isactiveModule(pModule) {
    if (game.modules.find(vModule => vModule.id == pModule)) {
        return game.modules.find(vModule => vModule.id == pModule).active;
    }
    
    return false;
};