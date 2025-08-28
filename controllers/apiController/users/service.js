import { writePool, readPool } from "../../../db/connection.js"; // add .js if using ESM


/**
 * Fetch a user by phone
 * @param {string} phone
 * @returns {Promise<Object|null>}
 */
async function signInService(phone) {
    try {
        const cleanedPhone = phone.replace(/\D/g, '');
        const [rows] = await readPool.query(
            'SELECT * FROM Users WHERE phone = ? LIMIT 1',
            [cleanedPhone]
        );
        return rows.length ? rows[0] : null;
    } catch (error) {
        console.error("Error fetching user:", error);
        throw error;
    }
}

export { signInService };
