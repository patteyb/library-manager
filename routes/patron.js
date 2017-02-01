var express = require('express');
var router = express.Router();
var Book = require('../models').books;
var Patron = require('../models').patrons;
var Loan = require('../models').loans;

/** Used to control pagination */
var pagination = {
  limit: 10,
  offset: 0,
  order: 'name',
  lastName: '%',
  address: '%',
  email: '%',
  libraryId: '%',
  numRecords: 0,
  numPages: 1
};

var subtitle = '';

/** GET home page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all patrons */
router.get('/patrons/all', function(req, res, next) {
  var order;
  getSearchAndOrder(req.query, pagination, function() {
    // If ordering by name, set up database order string
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Patron.findAndCountAll({ 
      order: order,
      where: {
        last_name: {$like: pagination.lastName},
        address: {$like: pagination.address},
        email: {$like: pagination.email},
        library_id: {$like: pagination.libraryId}
      },
      limit: pagination.limit,
      offset: pagination.offset
    })
      .then(function(patrons) {
        pagination.numRecords = patrons.count;
        pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
        getSubtitle(req.query, function() {
          res.render('all-patrons', { 
            patrons: patrons.rows, 
            pagination: pagination, 
            title: 'Patrons' ,
            subtitle: subtitle
          });
        });
      });
   });
});


/** GET Adding a new patron */
router.get('/patrons/new', function(req, res, next) {
  res.render('new-patron', { patron: Patron.build(), title: 'New Patron' });
});

/** POST Create a new patron in database */
router.post('/add/patron', function(req, res, next) {
  Patron.create(req.body).then(function() {
    res.redirect('/patrons/all');
  })
  .catch(function(error) {
    if(error.name === "SequelizeValidationError") {
        res.render('new-patron', { patron: Patron.build(), errors: error, title: "New Patron" });
    }
  }); 
});

/** GET Patron by ID */
router.get('/patron', function(req, res, next) {
  Patron.findAll({
    include: [{ model: Loan, include: [{ model: Book }] }],
    where: {id: req.query.id }
  })
  .then(function(patron) {
     var patronDetail = JSON.parse(JSON.stringify(patron));
     console.log("PATRON DETAIL: ", patronDetail[0].loans);
     res.render('patron-edit', { patron: patronDetail[0], title: "Patron: " });
   });
});

/** PUT Update a Patron */
router.put('/patron/:id', function(req, res, next) {
  console.log("IN PUT PATRON: ", req.params.id);
  Patron.findById(req.params.id).then(function(patron) {
    console.log("FOUND PATRON: ", patron);
    if(patron) {
      return patron.update(req.body);
    } else {
      res.send(404);
    }
  }).then(function(book) {
    res.redirect('/patrons/all');
  }).catch(function(error) {
    var errors = error;
    if(error.name === "SequelizeValidationError") {
      Patron.findAll({
        include: [{ model: Loan, include: [{ model: Book }] }],
        where: {id: req.params.id }
      })
      .then(function(book) {
        var patronDetail = JSON.parse(JSON.stringify(book));
        res.render('patron-edit', { patron: patronDetail[0], errors: errors, title: "Patron: " });
      });
    }
  }); 
});

/** 
 * FUNCTION getSearchAndOrder
 *    Sets the fields of the pagination object that control database query and paging
 * 
 *    @param {object} query - query parameters from url
 *    @param {paging} paging contains pertinent control attributes for pagination
 *    @return callback function
 */ 
function getSearchAndOrder(query, paging, callback) {

    if (query.offset) {
      paging.offset = query.offset;
    }
    if (query.order) {
       paging.order = query.order;
    }

    /** Check if search parameter came in on query.
     * If so, turn off search parameters
     */
    if (query.search) {
      if (query.search === 'off') {
        paging.lastName = '%';
        paging.address = '%';
        paging.email = '%';
        paging.libraryId = '%';
      }
    // If there is a query search string,
    // find what column to search on 
    } else if (query.searchStr) { 
      if (query.searchOn === 'last-name') {
        paging.lastName = query.searchStr + '%';
      } else if (query.searchOn === 'address') {
        paging.address = query.searchStr + '%';
      } else if (query.searchOn === 'email') {
        paging.email = query.searchStr + '%';
      } else if (query.searchOn === 'library-id') {
        paging.libraryId = query.searchStr + '%';
      }
    } 
    callback();
  }

/** 
 * FUNCTION getSubtitle
 *    Contructs a subtitle to indicate active search parameters
 * 
 *    @param {object} query - query parameters from url
 *    @return callback function
 */ 
  function getSubtitle(query, callback) {
    if (query.searchStr) {
      if (subtitle !== '') {
        subtitle = subtitle + ' AND ' + query.searchOn + ' begins with ' + query.searchStr;
      } else if (subtitle === '') {
          subtitle = 'WHERE ' + query.searchOn + ' begins with ' + query.searchStr;
      } 
    } else if (query.search) {
      subtitle = '';
    }
    callback();
}

module.exports = router;
