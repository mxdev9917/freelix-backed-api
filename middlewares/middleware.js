exports.checkID = (req, res, next, val) => {
    // Ensure val is a string
    if (typeof val !== 'string') {
        return res.status(400).json({
            status: "fail",
            message: `ID must be a string. Received ${typeof val}`
        });
    }

    // Regex for timestamp + UUIDv4
    const idRegex = new RegExp(
        '^\\d{14}-' + // timestamp YYYYMMDDHHmmss
        '[0-9a-f]{8}-' + // UUID part 1
        '[0-9a-f]{4}-' + // UUID part 2
        '4[0-9a-f]{3}-' + // UUID v4 marker (version 4)
        '[89ab][0-9a-f]{3}-' + // UUID variant
        '[0-9a-f]{12}$', 'i'
    );

    if (!idRegex.test(val)) {
        return res.status(400).json({
            status: "fail",
            message: "Invalid"
        });
    }

    req.validatedId = val;
    next();
};

// check nul body form owner
exports.checkBodyNull = (req, res, next) => {
    const body = req.body;
    const nullableFields = [''];
    for (let key in body) {
        if (!nullableFields.includes(key) && (body[key] === null || body[key].trim() === "")) {
            return res.status(400).json({ error: `The ${key} field cannot be null or empty.` });
        }
    }
    next();
};