module.exports = (sequelize, DataTypes) => {
  const Requirement = sequelize.define("Requirement", {
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // matchExplanation and ExperienceId moved to RequirementMatch table
  });

  Requirement.associate = (models) => {
    Requirement.belongsTo(models.Job, { onDelete: 'CASCADE' });

    // NEW: Many-to-Many relationship with Experience
    Requirement.belongsToMany(models.Experience, { 
      through: models.RequirementMatch,
      as: "MatchedExperiences"
    });

    Requirement.belongsToMany(models.Skill, { through: "RequirementSkills" });
  };

  return Requirement;
};