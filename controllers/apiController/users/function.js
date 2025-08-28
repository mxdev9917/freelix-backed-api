import * as encryptUtil from "../../../utils/encrypt.js";
import { generateTokenApp } from "../../../utils/auth.js";
import { signInService } from "./service.js";

async function signInFunction(phone, password) {
    if (!phone || !password) {
        throw new Error("Phone number and password are required");
    }

    const user = await signInService(phone);
    if (!user) throw new Error("User not found");

    if (user.user_status === "pending") throw new Error("Your account is pending approval");
    if (user.user_status === "blocked") throw new Error("Your account is blocked");

    const isMatch = await encryptUtil.comparePassword(password, user.user_password);
    if (!isMatch) throw new Error("Invalid phone number or password");

    const token = generateTokenApp({
        id: user.user_id,
        role: "user",
        system: "app",
        project: process.env.PROJECT_TAG,
    });

    const encryptedData = encryptUtil.encrypt(JSON.stringify({
        user_id: user.user_id,
        phone: user.phone,
        user_first: user.user_first,
        user_last: user.user_last,
        user_birth_date: user.user_birth_date,
        user_gender: user.user_gender,
        user_country: user.user_country,
        user_status: user.user_status,
        user_img: user.user_img,
    }));

    return { token, encryptedData };
}

export { signInFunction };
