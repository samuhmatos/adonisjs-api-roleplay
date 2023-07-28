import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import Hash from '@ioc:Adonis/Core/Hash'
import User from 'App/Models/User'

const BASE_URL = `${process.env.HOST}:${process.env.PORT}`
var token = ''
var user = {} as User

test.group('User', (group) => {
  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })
  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })

  group.before(async () => {
    const plainPassword = 'test'
    const newUser = await UserFactory.merge({ password: plainPassword }).create()

    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({
        email: newUser.email,
        password: plainPassword,
      })
      .expect(201)

    token = body.token.token
    user = newUser
  })

  group.after(async () => {
    await supertest(BASE_URL).delete('/sessions').set('Authorization', `Bearer ${token}`).send({})
  })

  test('it should create an user', async (assert) => {
    const userPayLoad = {
      email: 'test@test.com',
      username: 'test',
      password: 'test',
      avatar: 'https://image.com/image/1',
    }
    const { body } = await supertest(BASE_URL).post('/users').send(userPayLoad).expect(201)
    assert.exists(body.user, 'User info undefined')
    assert.exists(body.user.id, 'User ID undefined')
    assert.equal(body.user.email, userPayLoad.email)
    assert.equal(body.user.username, userPayLoad.username)
    assert.notExists(body.user.password, 'Password defined')
  })

  test('it should return 409 when email is already in use', async (assert) => {
    const { email } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        username: 'test',
        email: email,
        password: 'test',
      })
      .expect(409)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.include(body.message, 'email')
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('It should return 409 when username is already in use', async (assert) => {
    const { username } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        username,
        email: 'test@example.com',
        password: 'test',
      })
      .expect(409)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.include(body.message, 'username')
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('It shold return 422 when required data is not provided', async function (assert) {
    const { body } = await supertest(BASE_URL).post('/users').send({}).expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should return 422 error when providing invalid password', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        username: 'test',
        email: 'test@example.com',
        password: 'tes',
      })
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It shoult return 422 error providing invalid email', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        username: 'test',
        email: 'test',
        password: 'test',
      })
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should update an user', async (assert) => {
    const email = 'test@test.com'
    const avatar = 'https://github.com/samuhmatos.png'

    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({ email, avatar, password: user.password })
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.user, 'User undefined')
    assert.equal(body.user.email, email)
    assert.equal(body.user.avatar, avatar)
    assert.equal(body.user.id, user.id)
  })

  test("It should update the user's password", async (assert) => {
    const password = 'test'

    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({ email: user.email, avatar: user.avatar, password })
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.user, 'User undefined')
    assert.equal(body.user.id, user.id)

    await user.refresh()
    assert.isTrue(await Hash.verify(user.password, password))
  })

  test('It should return 422 when required data is not provided', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({})
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should return 422 when providing an invalid email', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({ password: user.password, avatar: user.avatar, email: 'test' })
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should return 422 when providing an invalid password', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({ email: user.email, avatar: user.avatar, password: '123' })
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should return 422 when providing an invalid avatar', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .send({ password: user.password, email: user.email, avatar: 'naoUrl' })
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })
})
