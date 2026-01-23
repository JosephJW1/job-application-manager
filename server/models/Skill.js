module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define("Skill", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Skill.associate = (models) => {
    // 1. Skills belong to Experience Demonstrations
    Skill.belongsToMany(models.Experience, { through: models.ExpSkillDemo });
    
    // 2. Skills belong to Requirements (New Structure)
    // A skill can be required by many different requirements
    Skill.belongsToMany(models.Requirement, { through: "RequirementSkills" });

    // 3. Keep other lists if you have them (like FieldTags/Positions)
    // Skill.belongsToMany(models.FieldTag, { through: "FieldTagSkills" });
    // Skill.belongsToMany(models.Position, { through: "PositionSkills" });
    
    // REMOVED: Skill.belongsToMany(models.Job, ...)
  };

  return Skill;
};