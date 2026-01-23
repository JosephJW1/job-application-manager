const express = require("express");
const router = express.Router();
const { Job, JobTag, Requirement, Skill, Experience, RequirementMatch } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// GET ALL
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        { model: JobTag, through: { attributes: [] } }, 
        { 
          model: Requirement,
          include: [
            { model: Skill },
            // Include the Matches and the Explanation from the junction table
            { 
              model: Experience,
              as: "MatchedExperiences",
              through: { attributes: ["matchExplanation"] }
            }
          ]
        }
      ]
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE
router.post("/", validateToken, async (req, res) => {
  const { title, company, description, jobTagIds, requirements } = req.body;

  try {
    const newJob = await Job.create({ title, company, description });

    if (jobTagIds && jobTagIds.length > 0) {
      await newJob.addJobTags(jobTagIds);
    }

    if (requirements && requirements.length > 0) {
      for (const reqData of requirements) {
        // Create Requirement (Description only)
        const newReq = await Requirement.create({
          JobId: newJob.id,
          description: reqData.description
        });

        // Add Skills
        if (reqData.skillIds && reqData.skillIds.length > 0) {
          await newReq.addSkills(reqData.skillIds);
        }

        // Add Experience Matches (Many-to-Many)
        if (reqData.matches && reqData.matches.length > 0) {
          for (const match of reqData.matches) {
            await newReq.addMatchedExperience(match.experienceId, {
              through: { matchExplanation: match.matchExplanation }
            });
          }
        }
      }
    }
    
    // Return full object
    const createdJob = await Job.findByPk(newJob.id, {
        include: [
          JobTag, 
          { 
            model: Requirement, 
            include: [Skill, { model: Experience, as: "MatchedExperiences" }] 
          }
        ]
    });

    res.json(createdJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put("/:id", validateToken, async (req, res) => {
  const { id } = req.params;
  const { title, company, description, jobTagIds, requirements } = req.body;

  try {
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await job.update({ title, company, description });

    if (jobTagIds) {
      await job.setJobTags(jobTagIds);
    }

    // Reset Requirements Strategy
    await Requirement.destroy({ where: { JobId: id } });

    if (requirements && requirements.length > 0) {
      for (const reqData of requirements) {
        const newReq = await Requirement.create({
          JobId: id,
          description: reqData.description
        });

        if (reqData.skillIds && reqData.skillIds.length > 0) {
          await newReq.addSkills(reqData.skillIds);
        }

        // Add Experience Matches
        if (reqData.matches && reqData.matches.length > 0) {
          for (const match of reqData.matches) {
            await newReq.addMatchedExperience(match.experienceId, {
              through: { matchExplanation: match.matchExplanation }
            });
          }
        }
      }
    }

    res.json({ message: "Updated Successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", validateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await Job.destroy({ where: { id: id } });
    res.json({ message: "Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;