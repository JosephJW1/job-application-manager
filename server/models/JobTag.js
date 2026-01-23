module.exports = (sequelize, DataTypes) => {
  const JobTag = sequelize.define("JobTag", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  JobTag.associate = (models) => {
    JobTag.belongsToMany(models.Job, { through: "JobJobTags" });
  };

  return JobTag;
};