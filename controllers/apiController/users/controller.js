import { signInFunction } from "./function.js";

const signInUser = async (req, res) => {
    const { phone, password } = req.body;

    try {
        const { token, encryptedData } = await signInFunction(phone, password);
        return res.status(200).json({
            status: 200,
            message: "Successfully signed in",
            token,
            data: encryptedData,
        });
    } catch (error) {
        console.error("Sign in error:", error.message);
        const statusCode = error.message.includes("not found") ? 404
            : error.message.includes("pending") || error.message.includes("blocked") ? 403
            : error.message.includes("Invalid") ? 401
            : 400;
        return res.status(statusCode).json({ status: statusCode, message: error.message });
    }
};

export { signInUser };
