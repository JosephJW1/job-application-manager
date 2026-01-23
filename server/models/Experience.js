module.exports = (sequelize, DataTypes) => {
  const Experience = sequelize.define("Experience", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // --- NEW FIELDS ---
    location: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // ------------------
  });

  Experience.associate = (models) => {
    Experience.belongsToMany(models.Skill, { 
      through: models.ExpSkillDemo,
      as: 'DemonstratedSkills' 
    });
    
    Experience.belongsToMany(models.Requirement, {
      through: models.RequirementMatch 
    });
  };

  return Experience;
};