const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.static(
    path.join(__dirname, "public")
));

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        application: "Azure Shopping Store"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Shopping store running on ${PORT}`);
});