'use strict';
module.exports = function(sequelize, DataTypes) {
  var books = sequelize.define('books', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey:true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    genre: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    first_published: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'IN'
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        books.hasMany(models.loans, {foreignKey: 'book_id'});
      },
        updateStatus: function(id) {
          books.findById(id).then(function(book) {
            if(book) {
              return book.update( {status: 'OUT'} );
            } else {
              return 404;
            }
          });
        } 
    },
    timestamps: false
  });
  return books;
};