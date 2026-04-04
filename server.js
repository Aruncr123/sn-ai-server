const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

console.log("USER:", process.env.SN_USER);
console.log("PASS:", process.env.SN_PASS);
console.log("INSTANCE:", process.env.SN_INSTANCE);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const auth = {
  username: process.env.SN_USER,
  password: process.env.SN_PASS
};

const instance = process.env.SN_INSTANCE;

/**
 * Get incidents (optional priority filter)
 */
app.get("/incidents", async (req, res) => {
  try {
    const priority = req.query.priority || "";
    const url = `${instance}/api/now/table/incident?sysparm_limit=5${priority ? `&priority=${priority}` : ""}`;

    const response = await axios.get(url, { auth });

    res.json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user details from incident number
 */
app.get("/incident-user", async (req, res) => {
  try {
    const number = req.query.number;

    const incidentRes = await axios.get(
      `${instance}/api/now/table/incident?number=${number}`,
      { auth }
    );

    const userSysId = incidentRes.data.result[0].assigned_to.value;

    const userRes = await axios.get(
      `${instance}/api/now/table/sys_user/${userSysId}`,
      { auth }
    );

    res.json(userRes.data.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get CI details
 */
app.get("/ci", async (req, res) => {
  try {
    const name = req.query.name;

    const response = await axios.get(
      `${instance}/api/now/table/cmdb_ci?name=${name}`,
      { auth }
    );

    res.json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create incident
 */
app.post("/create-incident", async (req, res) => {
  try {
    const { short_description } = req.body;

    const response = await axios.post(
      `${instance}/api/now/table/incident`,
      { short_description },
      { auth }
    );

    res.json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});