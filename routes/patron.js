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
  search: '%',
  numRecords: 0,
  numPages: 1
};

/** GET home page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all patrons */
router.get('/patrons/all', function(req, res, next) {
  var order;
  getPaging(req.query, pagination, function() {
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Patron.findAll({ 
      order: order,
      where: {
        last_name: {
          $like: pagination.search
        }
      },
      limit: pagination.limit,
      offset: pagination.offset
    })
      .then(function(patrons) {
        res.render('all-patrons', { 
          patrons: patrons, 
          pagination: pagination, 
          title: 'Patrons' 
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


/** GET Search for patron */
router.post('/patrons/find', function(req, res, next) {
  var order;

  getPaging(req.query, pageLimit, function(paging) {
    pagination = paging;  
    pagination.search = req.body.name;
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Patron.findAll({
      order: order,
      where: {
        last_name: {
          $like: pagination.search + '%'
        }
      }
    })
      .then(function(patrons) {
        res.render('all-patrons', { patrons: patrons, pagination: pagination, title: 'Patrons' });
      });
  });
});

/** 
 * FUNCTION getPaging
 *    Sets the paging object to control pagination 
 * 
 *    @param {object} query - query parameters from url
 *    @param {paging} paging contains pertinent control attributes for pagination
 *    @return callback function
 */ 
function getPaging(query, paging, callback) {
    if (query.offset) {
      paging.offset = query.offset;
    }
    if (query.order) {
       paging.order = query.order;
    }
    if (query.search && query.search !== paging.search) {
      paging.search = query.search + '%';
    }
    Patron.count({where: {
        last_name: {
          $like: pagination.search
        }
      } 
    }).then(function(count) {
      paging.numRecords = count;
      paging.numPages = Math.ceil(paging.numRecords / paging.limit);
      callback();
    });
  }

module.exports = router;
