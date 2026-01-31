module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define("Users", {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Users.associate = (models) => {
    Users.hasMany(models.Job, { onDelete: "cascade" });
    Users.hasMany(models.Experience, { onDelete: "cascade" });
    Users.hasMany(models.Skill, { onDelete: "cascade" });
    Users.hasMany(models.JobTag, { onDelete: "cascade" });
  };

  return Users;
};