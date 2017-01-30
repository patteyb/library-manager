var express = require('express');
var router = express.Router();
var moment = require('moment');
var Book = require('../models').books;
var Patron = require('../models').patrons;
var Loan = require('../models').loans;

/** Used to control pagination */
var pagination = {
  limit: 10,
  offset: 0,
  order: 'title',
  search: '%',
  numRecords: 0,
  numPages: 1
};

/** GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all books */
router.get('/books/all', function(req, res, next) {
  getPaging(req.query, pagination, function() {
    Book.findAll({
        order: [[pagination.order, 'ASC']],
        limit: pagination.limit,
        offset: pagination.offset
      })
      .then(function(books) {
        res.render('all-books', { books: books, pagination: pagination, title: "Books" });
      }); 
  });
});


/** GET Adding a new book -- display the form */
router.get('/books/new', function(req, res, next) {
  res.render('new-book', { book: Book.build(), title: "New Book" });
});

/** POST Create a new book in database */
router.post('/add', function(req, res, next) {
  Book.create(req.body).then(function() {
    res.redirect('/books/all?offset=0&order=title');
  }).catch(function(error) {
    if(error.name === "SequelizeValidationError") {
        res.render('new-book', { book: Book.build(), errors: error, title: "New Book" });
    }
  }); 
});

/** GET Book by ID */
router.get('/book', function(req, res, next) {
  Book.findAll({
    include: [{ model: Loan, include: [{ model: Patron }] }],
    where: {id: req.query.id }
  })
  .then(function(book) {
     var bookDetail = JSON.parse(JSON.stringify(book));
     res.render('book-edit', { book: bookDetail[0], title: "Edit Book" });
   });
});

/** PUT Update book in database */
router.put('/book', function(req, res, next) {
  Book.findById(req.query.id).then(function(book) {
    if(book) {
      return book.update(req.body);
    } else {
      res.send(404);
    }
  }).then(function(book) {
    res.redirect('/books');
  }).catch(function(error) {
    var errors = error;
    if(error.name === "SequelizeValidationError") {
      Book.findAll({
        include: [{ model: Loan, include: [{ model: Patron }] }],
        where: {id: req.params.id }
      })
      .then(function(book) {
        var bookDetail = JSON.parse(JSON.stringify(book));
        res.render('book-edit', { book: bookDetail[0], errors: errors, title: "Edit Book" });
      });
    }
  }); 
});

/** GET All books that are overdue */
router.get('/books/overdue', function(req, res, next) {
  getPaging(req.query, pagination, function() {
    Book.findAll({
      include: [{ 
        model: Loan, 
        where: {
          return_by: {
            $lt: new Date()
          },
          returned_on: null
        } 
      }],
      order: [[pagination.order, 'ASC']],
      limit: pagination.limit,
      offset: pagination.offset
      }).then(function(books) {
          var bookList = JSON.parse(JSON.stringify(books));
          res.render('books-overdue', {books: books, pagination: pagination, title: 'Overdue Books'});
      });
  });
});

/** GET All books that are checked out */
router.get('/books/out', function(req, res, next) {
  getPaging(req.query, pagination, function() {
    Book.findAll({
      order: [[pagination.order, 'ASC']],
      include: [{ 
        model: Loan, 
        where: {
          returned_on: null
          } }],
      where: {
        status: 'OUT',
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(books) {
        var bookList = JSON.parse(JSON.stringify(books));
        var pastDue = moment().format('YYYY-MM-DD');
        res.render('books-out', {
          books: bookList, 
          pastDue: pastDue, 
          pagination: pagination,
          title: 'Checked-out Books'
        });
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
  Book.count().then(function(count) {
    paging.numRecords = count;
    paging.numPages = Math.ceil(paging.numRecords / paging.limit);
    callback();
  });
}

module.exports = router;
