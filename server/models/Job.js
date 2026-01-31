module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define("Job", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  Job.associate = (models) => {
    // Replaced Position with JobTags (Many-to-Many)
    Job.belongsToMany(models.JobTag, { through: "JobJobTags" });
    
    Job.hasMany(models.Requirement, { 
      onDelete: "cascade" 
    });

    Job.belongsTo(models.Users, {
      foreignKey: {
        allowNull: false,
      },
    });
  };

  return Job;
};