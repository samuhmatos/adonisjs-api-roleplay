import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import Hash from '@ioc:Adonis/Core/Hash'
import Mail from '@ioc:Adonis/Addons/Mail'
import { DateTime, Duration } from 'luxon'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

test.group('Passwords', (group) => {
  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })
  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })

  test('It should send an email with forgot password instructions', async (assert) => {
    const { email, username } = await UserFactory.create()

    Mail.trap((message) => {
      assert.deepEqual(message.to, [
        {
          address: email,
        },
      ])
      assert.deepEqual(message.from, {
        address: 'no-replay@roleplay.com',
      })
      assert.equal(message.subject, 'Roleplay: Recuperação de senha')
      assert.include(message.html!, username)
    })

    await supertest(BASE_URL)
      .post('/forgot-password')
      .send({
        email,
        resetPasswordUrl: 'https://example.com/reset-password',
      })
      .expect(204)

    Mail.restore()
  })

  test('It should create a reset password token', async (assert) => {
    const user = await UserFactory.create()

    await supertest(BASE_URL)
      .post('/forgot-password')
      .send({
        email: user.email,
        resetPasswordUrl: 'http://www.example.com/reset-password',
      })
      .expect(204)

    const tokens = await user.related('tokens').query()

    assert.isNotEmpty(tokens)
  }).timeout(0)

  test('It should return 422 when required data is not provided or data is invalid', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .post('/forgot-password')
      .send({
        // email: user.email,
        // resetPasswordUrl: 'url',
      })
      .expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should be able to reset password', async function (assert) {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'token' })

    await supertest(BASE_URL)
      .post('/reset-password')
      .send({
        token,
        password: '123456',
      })
      .expect(204)

    await user.refresh()
    const checkPassword = await Hash.verify(user.password, '123456')
    assert.isTrue(checkPassword)
  })

  test('It should return 422 when required data is not provided or data is invalid', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/reset-password').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should return 404 when using the same token twice', async (assert) => {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'token' })

    await supertest(BASE_URL)
      .post('/reset-password')
      .send({
        token,
        password: '123456',
      })
      .expect(204)

    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({
        token,
        password: '123456',
      })
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('It cannot reset password when token is expired after 2 hours', async (assert) => {
    const user = await UserFactory.create()
    const date = DateTime.now().minus(Duration.fromISOTime('02:01'))
    const { token } = await user.related('tokens').create({ token: 'token', createdAt: date })

    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({
        token,
        password: '123456',
      })
      .expect(410)

    assert.equal(body.code, 'TOKEN_EXPIRED')
    assert.equal(body.status, 410)
    assert.equal(body.message, 'Token has expired')
  })
})
