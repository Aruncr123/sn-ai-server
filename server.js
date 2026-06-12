const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());


app.use((req, res, next) => {

  console.log("Path:", req.path);
  console.log("API Key:", req.headers["x-api-key"]);

  if (req.path === "/" || req.path === "/openapi.json") {
      return next();
  }

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {

      return res.status(401).json({
          success: false,
          message: "Unauthorized"
      });

  }

  next();

});

const PORT = process.env.PORT || 3000;

const auth = {
    username: process.env.SN_USER,
    password: process.env.SN_PASS
};

const instance = process.env.SN_INSTANCE;

console.log("INSTANCE:", instance);

/**
 * Helper Function
 */
async function snGet(url) {
    return await axios.get(url, { auth });
}

async function snPost(url, body) {
    return await axios.post(url, body, { auth });
}

/**
 * Health Check
 */
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "SN AI Server is running 🚀"
    });
});

/**
 * Get Incidents
 *
 * Example:
 * /incidents?priority=1
 */
app.get("/incidents", async (req, res) => {

    try {

        const priority = req.query.priority || "";

        const url =
            `${instance}/api/now/table/incident?sysparm_limit=20${priority ? `&priority=${priority}` : ""}`;

        const response = await snGet(url);

        res.json(response.data.result);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Get Incident Details
 *
 * Example:
 * /incident/INC0010001
 */
app.get("/incident/:number", async (req, res) => {

    try {

        const number = req.params.number;

        const response = await snGet(
            `${instance}/api/now/table/incident?number=${number}`
        );

        if (!response.data.result.length) {

            return res.status(404).json({
                message: "Incident not found"
            });

        }

        res.json(response.data.result[0]);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Get User Details From Incident
 */
app.get("/incident-user", async (req, res) => {

    try {

        const number = req.query.number;

        const incidentRes = await snGet(
            `${instance}/api/now/table/incident?number=${number}`
        );

        if (!incidentRes.data.result.length) {

            return res.status(404).json({
                message: "Incident not found"
            });

        }

        const assignedTo =
            incidentRes.data.result[0].assigned_to;

        if (!assignedTo || !assignedTo.value) {

            return res.status(404).json({
                message: "No assigned user"
            });

        }

        const userRes = await snGet(
            `${instance}/api/now/table/sys_user/${assignedTo.value}`
        );

        res.json(userRes.data.result);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Get User Details
 *
 * Example:
 * /user/fred.luddy
 */
app.get("/user/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;

        const response = await snGet(
            `${instance}/api/now/table/sys_user?user_name=${userId}&sysparm_limit=1`
        );

        if (!response.data.result.length) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        const user = response.data.result[0];

        res.json({
            name: user.name,
            user_name: user.user_name,
            email: user.email,
            active: user.active,
            title: user.title
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * User Lock Status
 */
app.get("/user-lock-status/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;

        const response = await snGet(
            `${instance}/api/now/table/sys_user?user_name=${userId}&sysparm_limit=1`
        );

        if (!response.data.result.length) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        const user = response.data.result[0];

        res.json({
            userId: userId,
            locked_out: user.locked_out
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Unlock Users
 *
 * Uses Scripted REST API
 */
app.post("/unlock-users", async (req, res) => {

    try {

        const response = await snPost(
            `${instance}/api/882278/mcp_user_management/unlockUsers`,
            req.body
        );

        res.json(response.data.result);

    } catch (error) {

        console.log(error.response?.data);

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Create Incident
 */
app.post("/create-incident", async (req, res) => {

    try {

        const {
            short_description,
            description,
            priority
        } = req.body;

        const response = await snPost(
            `${instance}/api/now/table/incident`,
            {
                short_description,
                description,
                priority
            }
        );

        res.json(response.data.result);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

//CMDB Health Assessment
app.get("/cmdb-health", async (req, res) => {

  try {

      const noOwner = await snGet(
          `${instance}/api/now/table/cmdb_ci?sysparm_query=owned_byISEMPTY`
      );

      const noSupportGroup = await snGet(
          `${instance}/api/now/table/cmdb_ci?sysparm_query=support_groupISEMPTY`
      );

      const staleCIs = await snGet(
          `${instance}/api/now/table/cmdb_ci?sysparm_query=sys_updated_onRELATIVELT@dayofweek@ago@90`
      );

      res.json({
          missingOwners: noOwner.data.result.length,
          missingSupportGroups: noSupportGroup.data.result.length,
          staleCIs: staleCIs.data.result.length
      });

  } catch (error) {

      console.log(error.response?.data || error.message);

      res.status(500).json({
          error: error.message
      });
  }

});

/**
 * Create Change Request
 */
app.post("/create-change", async (req, res) => {

    try {

        const {
            short_description,
            description
        } = req.body;

        const response = await snPost(
            `${instance}/api/now/table/change_request`,
            {
                short_description,
                description
            }
        );

        res.json(response.data.result);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * CI Overview
 */
app.get("/ci-overview/:name", async (req, res) => {

    try {

        const name = req.params.name;

        const response = await snGet(
            `${instance}/api/now/table/cmdb_ci?name=${name}`
        );

        if (!response.data.result.length) {

            return res.status(404).json({
                message: "CI not found"
            });

        }

        res.json(response.data.result[0]);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * CI Relationships
 */
app.get("/ci-relationships/:name", async (req, res) => {

    try {

        const name = req.params.name;

        const ciRes = await snGet(
            `${instance}/api/now/table/cmdb_ci?name=${name}`
        );

        if (!ciRes.data.result.length) {

            return res.status(404).json({
                message: "CI not found"
            });

        }

        const ciSysId = ciRes.data.result[0].sys_id;

        const relRes = await snGet(
            `${instance}/api/now/table/cmdb_rel_ci?child=${ciSysId}`
        );

        res.json({
            ci: name,
            relationships: relRes.data.result
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Similar Incidents
 */
app.get("/similar-incidents/:number", async (req, res) => {

    try {

        const number = req.params.number;

        const incidentRes = await snGet(
            `${instance}/api/now/table/incident?number=${number}`
        );

        if (!incidentRes.data.result.length) {

            return res.status(404).json({
                message: "Incident not found"
            });

        }

        const shortDescription =
            incidentRes.data.result[0].short_description;

        const words = shortDescription
            .split(" ")
            .filter(word => word.length > 3)
            .slice(0, 3);

        const query = words
            .map(word => `short_descriptionLIKE${word}`)
            .join("^OR");

        const similarRes = await snGet(
            `${instance}/api/now/table/incident?sysparm_query=${query}&sysparm_limit=10`
        );

        res.json({
            originalIncident: number,
            shortDescription: shortDescription,
            similarIncidents: similarRes.data.result
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});

/**
 * Ownership Risk Assessment
 */
app.get("/ci-risk/:name", async (req, res) => {

  try {

      const ciName = req.params.name;

      const ciRes = await snGet(
          `${instance}/api/now/table/cmdb_ci?name=${encodeURIComponent(ciName)}&sysparm_limit=1`
      );

      if (!ciRes.data.result.length) {

          return res.status(404).json({
              success: false,
              message: "CI not found"
          });
      }

      const ci = ciRes.data.result[0];

      var riskScore = 0;
      var findings = [];
      var recommendations = [];

      /*
       * Business Owner
       */
      if (!ci.owned_by || !ci.owned_by.value) {

          riskScore += 3;

          findings.push(
              "Business Owner is missing"
          );

          recommendations.push(
              "Assign a Business Owner"
          );
      }

      /*
       * Support Group
       */
      if (!ci.support_group || !ci.support_group.value) {

          riskScore += 3;

          findings.push(
              "Support Group is missing"
          );

          recommendations.push(
              "Assign a Support Group"
          );
      }

      /*
       * Assignment Group
       */
      if (!ci.assignment_group || !ci.assignment_group.value) {

          riskScore += 2;

          findings.push(
              "Assignment Group is missing"
          );

          recommendations.push(
              "Assign an Assignment Group"
          );
      }

      /*
       * Managed By
       */
      if (!ci.managed_by || !ci.managed_by.value) {

          riskScore += 2;

          findings.push(
              "Managed By is missing"
          );

          recommendations.push(
              "Assign a CI Manager"
          );
      }

      /*
       * Operational Status
       */
      if (!ci.operational_status) {

          riskScore += 1;

          findings.push(
              "Operational Status is missing"
          );

          recommendations.push(
              "Update Operational Status"
          );
      }

      /*
       * Determine Risk Level
       */
      var riskLevel = "Low";

      if (riskScore >= 8) {

          riskLevel = "High";

      } else if (riskScore >= 4) {

          riskLevel = "Medium";
      }

      res.json({

          success: true,

          ciName: ci.name,

          riskScore: riskScore,

          riskLevel: riskLevel,

          findings: findings,

          recommendations: recommendations
      });

  } catch (error) {

      console.log(error.response?.data || error.message);

      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

});