var express = require('express');
var moment = require('moment');
var router = express.Router();
var Book = require('../models').books;
var Patron = require('../models').patrons;
var Loan = require('../models').loans;

/** Used to control pagination */
var pagination = {
  limit: 10,
  offset: 0,
  order: 'title',
  title: '%',
  lastName: '%',
  loanedOn: '%',
  returnBy: '%',
  returnedOn: '%', 
  numRecords: 0,
  numPages: 1
};

var subtitle = '';

/** GET home page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all loans */
router.get('/loans/all', function(req, res, next) {
  var order;
  getSearchAndOrder(req.query, pagination, function() {
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAndCountAll({
        order: order,
        include: [{ model: Book, 
            where: {title: {$like: pagination.title}} 
          }, { model: Patron, 
            where: {last_name: {$like: pagination.lastName}}
        }],
        where: {
          loaned_on: {$like: pagination.loanedOn},
          return_by: {$like: pagination.returnBy},
          returned_on: {$like: pagination.returnedOn}
        },
        limit: pagination.limit,
        offset: pagination.offset
      })
      .then(function(loans) {
        pagination.numRecords = loans.count;
        pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
        getSubtitle(req.query, function() {
          var pastDue = moment().format('YYYY-MM-DD');
          console.log('About to render...', pagination.numRecords);
          res.render('all-loans', { 
            loans: loans.rows, 
            pagination: pagination, 
            pastDue: pastDue, 
            title: 'Loans',
            subtitle: subtitle });
        });
      });
    });
});

/** GET OVERDUE: All loans that are overdue */
router.get('/loans/overdue', function(req, res, next) {
  var order;
  getSearchAndOrder(req.query, pagination, function() {
    console.log('----------IN OVERDUE ROUTING: ', pagination);
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAndCountAll({
        order: order,
        include: [{ model: Book, 
            where: {title: {$like: pagination.title}} 
          }, { model: Patron, 
            where: {last_name: {$like: pagination.lastName}}
        }],
      where: {
        return_by: {$lt: moment().format('YYYY-MM-DD')},
        loaned_on: {$like: pagination.loanedOn},
        returned_on: null
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(loans) {
       console.log('----------IN OVERDUE ROUTING: loans:', loans.rows);
        pagination.numRecords = loans.count;
        pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
        getSubtitle(req.query, function() {
          console.log('Substitle: ', subtitle);
          console.log(loans.rows);
            res.render('loans-overdue', {
              loans: loans.rows, 
              pagination: pagination, 
              title: 'Overdue Loans',
              subtitle: subtitle
            });
        });
    });
  });
});

/** GET CHECKED OUT: All loans that are checked out */
router.get('/loans/out', function(req, res, next) {
  var order;
  getSearchAndOrder(req.query, pagination, function() {
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAndCountAll({
        order: order,
        include: [{ model: Book, 
            where: {title: {$like: pagination.title}} 
          }, { model: Patron, 
            where: {last_name: {$like: pagination.lastName}}
        }],
      where: {
        '$book.status$': 'OUT',
        loaned_on: {$like: pagination.loanedOn},
        return_by: {$like: pagination.returnBy},
        returned_on: null
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(loans) {
        pagination.numRecords = loans.count;
        pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
        getSubtitle(req.query, function() {
            var pastDue = moment().format('YYYY-MM-DD');
            res.render('loans-out', {
              loans: loans.rows, 
              pagination: pagination, 
              pastDue: pastDue, 
              title: 'Checked-out Loans',
              subtitle: subtitle
            });
        });
    });
  });
});

/** GET Adding a new loan -- display the form */
router.get('/loans/new', function(req, res, next) {
    var bookList;
    Book.findAll({
          attributes: [ 'id', 'title' ],
          order: [['title', 'ASC']],
          where: {
              status: 'IN'
          }
        })
    .then(function(books) {
        bookList = books;
    }).then(function() {
        Patron.findAll({order: [['last_name', 'ASC']] })
        .then(function(patrons) {
            res.render('new-loan', { 
                loan: Loan.build(), 
                books: bookList, 
                patrons: patrons,
                title: 'New Loan' 
            });
        });
    });
});

/** GET Loan by id */
router.get('/return/:id', function(req, res, next) {
    Loan.findAll({
      include: [ Book, Patron ],
      where: {
        '$book_id$': req.params.id,
        returned_on: null
      }
    }).then(function(loan) {
      loan[0].returned_on = moment().format('YYYY-MM-DD');
      res.render('return-book.jade', { loan: loan[0], title: 'Return Book'});
    });
});

/** POST Create a new loan in database */
router.post('/loans/add', function(req, res, next) {
  Loan.create(req.body).then(function(loan) {
      Book.updateStatus(loan.book_id);
      res.redirect('/loans/all');
  });
});

/** PUT Return book */
router.put('/return/:id', function(req, res, next) {
  Loan.findOne({ 
      include: [{ model: Book }],
      where: {
        id: req.params.id
      }
    }).then(function(loan) {
        var bookId = loan.book.id;
        console.log('BOOK ID: ', bookId);
        Book.update({ status: 'IN' }, {
            where: {
                id: bookId
            }
        });
    }).then(function() {
          Loan.update({ returned_on: req.body.returned_on }, {
                where: {
                    id: req.params.id
                }
          });
        }).then(function(loan) {
                res.redirect('/loans/all');
        }).catch(function(error) {
            res.status(500).send(error);
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

    /** Check if 'search=off' came in on query.
     * If so, turn off search parameters
     */
    if (query.search) {
      if (query.search === 'off') {
        paging.title = '%';
        paging.lastName = '%';
        paging.loanedOn = '%';
        paging.returnBy = '%';
        paging.returnedOn = '%';
      }
    // If there is a query search string,
    // find what column to search on 
    } else if (query.searchStr) {
      if (query.searchOn === 'title') {
        paging.title = query.searchStr + '%';
      } else if (query.searchOn === 'last-name') {
        paging.lastName = query.searchStr + '%';
      } else if (query.searchOn === 'loaned-on') {
        paging.loanedOn = query.searchStr + '%';
      } else if (query.searchOn === 'return-by') {
        paging.returnBy = query.searchStr + '%';
      } else if (query.searchOn === 'returned-on') {
        paging.returnedOn = query.searchStr + '%';
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
    console.log()
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
