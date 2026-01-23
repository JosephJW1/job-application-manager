module.exports = (sequelize, DataTypes) => {
  const ExpSkillDemo = sequelize.define("ExpSkillDemo", {
    explanation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Foreign keys (ExperienceId, SkillId) are added automatically by Sequelize associations
  });

  return ExpSkillDemo;
};