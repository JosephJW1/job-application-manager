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
  });

  Experience.associate = (models) => {
    // Direct One-to-Many to access the junction table records directly
    // This allows us to find demos that have no Skill associated (orphaned explanations)
    Experience.hasMany(models.ExpSkillDemo, {
      as: 'SkillDemonstrations',
      foreignKey: 'ExperienceId'
    });
    
    // Kept for legacy support if needed
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