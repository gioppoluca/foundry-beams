import { MOD_NAME } from "./beams-const.js";

export async function reactiveMacro(macro_name) {
    console.log("reactive macro")
    let macro = game.macros.getName(macro_name);
    console.log(macro)
    if (macro_name && !macro) {
        ui.notifications.warn(MOD_NAME + ": Failed to find macro:" + macro_name);
    }
    if (macro) {
        //macro.execute({ token: sensor, light_count: active.size });
        macro.execute({});
    }
}