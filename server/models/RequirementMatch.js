module.exports = (sequelize, DataTypes) => {
  const RequirementMatch = sequelize.define("RequirementMatch", {
    matchExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Keys for RequirementId and ExperienceId are added by associations
  });

  return RequirementMatch;
};