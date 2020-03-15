const express = require('express')

const UserCtrl = require('../../controllers/admin/user')
const PaymentCtrl = require('../../controllers/admin/payment')
const { catchError } = require('../../controllers/error')

const router = express.Router()

router.get('/pages/:id' , UserCtrl.checkAuth, catchError(PaymentCtrl.getCustomers))
router.get('/transactions/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.getTransactions))
router.get('/refund/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.refundCharge))
router.get('/coming-invoice/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.getUpcomingInvoice))
router.post('/card', UserCtrl.checkAuth, catchError(PaymentCtrl.getCard))
router.get('/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.getCustomer))
module.exports = router
