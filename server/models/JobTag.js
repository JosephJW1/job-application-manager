module.exports = (sequelize, DataTypes) => {
  const JobTag = sequelize.define("JobTag", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  JobTag.associate = (models) => {
    JobTag.belongsToMany(models.Job, { through: "JobJobTags" });
    
    JobTag.belongsTo(models.Users, {
      foreignKey: {
        allowNull: false,
      },
    });
  };

  return JobTag;
};