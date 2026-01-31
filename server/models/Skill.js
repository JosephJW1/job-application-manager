module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define("Skill", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Skill.associate = (models) => {
    // We add an explicit alias 'SkillDemos' here
    Skill.belongsToMany(models.Experience, { 
      through: models.ExpSkillDemo,
      as: 'SkillDemos' 
    });
    
    // Skills associated with Requirements
    Skill.belongsToMany(models.Requirement, { 
      through: "RequirementSkills",
      as: 'Requirements'
    });

    Skill.belongsTo(models.Users, {
      foreignKey: {
        allowNull: false,
      },
    });
  };

  return Skill;
};