'use strict';
var moment = require('moment');
module.exports = function(sequelize, DataTypes) {

  var loans = sequelize.define('loans', {
   id: {
      type: DataTypes.INTEGER,
      primaryKey:true
    },
    book_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patron_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    loaned_on: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: moment().format('YYYY-MM-DD')
    },
    return_by: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: moment().add(14, 'd').format('YYYY-MM-DD')
    },
    returned_on: DataTypes.DATEONLY
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        loans.belongsTo(models.patrons, {foreignKey: 'patron_id'});
        loans.belongsTo(models.books, {foreignKey: 'book_id'});
      }
    }, 
    timestamps: false
  });
  return loans;
};