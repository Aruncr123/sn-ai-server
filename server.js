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

/**
 * Incident Resolution Advisor
 *
 * Returns historical resolutions from similar incidents
 */
app.get("/incident-resolution/:number", async (req, res) => {

  try {

      const number = req.params.number;

      /*
       * Get Current Incident
       */
      const incidentRes = await snGet(
          `${instance}/api/now/table/incident?sysparm_query=number=${number}&sysparm_limit=1`
      );

      if (!incidentRes.data.result.length) {

          return res.status(404).json({
              success: false,
              message: "Incident not found"
          });

      }

      const incident =
          incidentRes.data.result[0];

      const shortDescription =
          incident.short_description || "";

      const description =
          incident.description || "";

      const category =
          incident.category || "";

      const subcategory =
          incident.subcategory || "";

      /*
       * Build Similar Incident Query
       */
      let query = "";

      if (category && subcategory) {

          query =
              `category=${category}` +
              `^subcategory=${subcategory}`;

      } else {

          const stopWords = [
              "issue",
              "issues",
              "working",
              "unable",
              "cannot",
              "cant",
              "problem",
              "error",
              "failed",
              "failure",
              "access",
              "user",
              "request",
              "server",
              "application",
              "system",
              "please",
              "need",
              "not"
          ];

          const words = shortDescription
              .toLowerCase()
              .split(/\s+/)
              .filter(function(word) {

                  return word.length > 2 &&
                      stopWords.indexOf(word) === -1;

              })
              .slice(0, 3);

          query = words
              .map(function(word) {

                  return (
                      `short_descriptionLIKE${word}` +
                      `^ORdescriptionLIKE${word}`
                  );

              })
              .join("^OR");
      }

      const encodedQuery =
          `${query}` +
          `^state=7` +
          `^close_codeINSolved (Work Around),Solved (Permanently),Solved Remotely (Work Around),Solved Remotely (Permanently)` +
          `^closed_atRELATIVEGE@month@ago@3`;

      /*
       * Get Similar Closed Incidents
       */
      const similarRes = await snGet(
          `${instance}/api/now/table/incident` +
          `?sysparm_query=${encodeURIComponent(encodedQuery)}` +
          `&sysparm_fields=number,short_description,description,close_notes,close_code,category,subcategory` +
          `&sysparm_limit=20`
      );

      const incidents =
          similarRes.data.result || [];

      /*
       * Clean Resolution Notes
       */
      function cleanResolution(note) {

          if (!note) {

              return "";

          }

          note = note.replace(/^VR\s*/gi, "");

          note = note.replace(
              /https?:\/\/\S+/gi,
              ""
          );

          note = note.replace(
              /Hi\s+\w+,?/gi,
              ""
          );

          note = note.replace(
              /Hello\s+\w+,?/gi,
              ""
          );

          note = note.replace(
              /Thanks for reaching out[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Best Regards[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Regards[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Assigned To:[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Please fill out our short survey[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /User confirmed to close the ticket\.?/gi,
              ""
          );

          note = note.replace(
              /Vendor Integration Job Runner[\s\S]*?resolution:/gi,
              ""
          );

          note = note.replace(
              /Was the remote access taken[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Tools used for issue resolution[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /KB\/SOP number if available[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Was issue resolved completely or partially[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Was user confirmation taken[\s\S]*/gi,
              ""
          );

          note = note.replace(
              /Is screenshot attached[\s\S]*/gi,
              ""
          );

          note = note.replace(/\n+/g, " ");
          note = note.replace(/\s+/g, " ");

          return note.trim();

      }

      /*
       * Historical Resolutions
       */
      const historicalResolutions = incidents
          .map(function(inc) {

              return {

                  incidentNumber:
                      inc.number,

                  shortDescription:
                      inc.short_description,

                  category:
                      inc.category,

                  subcategory:
                      inc.subcategory,

                  closeCode:
                      inc.close_code,

                  resolution:
                      cleanResolution(
                          inc.close_notes
                      )

              };

          })
          .filter(function(item) {

              if (!item.resolution) {

                  return false;

              }

              const resolution =
                  item.resolution.toLowerCase();

              if (resolution.length < 30) {

                  return false;

              }

              const ignorePatterns = [
                  "closing this ticket",
                  "user asked me",
                  "issue no longer persistent",
                  "reopen your ticket",
                  "please fill out our short survey",
                  "thank you and have a nice day",
                  "user confirmed to close",
                  "we are closing this ticket",
                  "duplicate ticket",
                  "resolved this ticket",
                  "happy to help"
              ];

              return !ignorePatterns.some(function(pattern) {

                  return resolution.indexOf(pattern) > -1;

              });

          });

      /*
       * Remove Duplicate Resolutions
       */
      const uniqueResolutions = [];

      const seen = {};

      historicalResolutions.forEach(function(item) {

          const key =
              item.resolution.toLowerCase();

          if (!seen[key]) {

              seen[key] = true;

              uniqueResolutions.push(item);

          }

      });

      /*
       * Response
       */
      res.json({

          success: true,

          incidentNumber:
              number,

          currentIncident: {

              shortDescription:
                  shortDescription,

              description:
                  description,

              category:
                  category,

              subcategory:
                  subcategory

          },

          searchCriteria: {

              category:
                  category,

              subcategory:
                  subcategory,

              queryUsed:
                  query

          },

          similarIncidentCount:
              uniqueResolutions.length,

          historicalResolutions:
              uniqueResolutions,

          aiInstruction:
              "Analyze the historical resolutions and identify common troubleshooting patterns, probable root cause, recommended resolution steps, confidence level, and a concise resolution summary."

      });

  } catch (error) {

      console.error(error);

      res.status(500).json({

          success: false,
          error: error.message

      });

  }

});

app.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

});