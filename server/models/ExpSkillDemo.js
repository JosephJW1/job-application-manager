module.exports = (sequelize, DataTypes) => {
  const ExpSkillDemo = sequelize.define("ExpSkillDemo", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ""
    },
    // Allows link to remain even if the Skill is deleted
    SkillId: {
      type: DataTypes.INTEGER,
      allowNull: true 
    },
    ExperienceId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  });

  ExpSkillDemo.associate = (models) => {
    ExpSkillDemo.belongsTo(models.Skill, { foreignKey: 'SkillId' });
    ExpSkillDemo.belongsTo(models.Experience, { foreignKey: 'ExperienceId' });
  };

  return ExpSkillDemo;
};