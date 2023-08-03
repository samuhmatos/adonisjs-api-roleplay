import Database from '@ioc:Adonis/Lucid/Database'
import GroupRequest from 'App/Models/GroupRequest'
import User from 'App/Models/User'
import { GroupFactory, UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
var token = ''
var user = {} as User

test.group('Group Request', (group) => {
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

  test('it should create a group request', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200)

    assert.exists(body.groupRequest, 'GroupRequest Undefined')
    assert.equal(body.groupRequest.userId, user.id)
    assert.equal(body.groupRequest.groupId, group.id)
    assert.equal(body.groupRequest.status, 'PENDING')
  })
  test('It should return 409 when group request already exist', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('It should return 422 when user is already in the group', async (assert) => {
    const groupPayload = {
      name: 'test',
      description: 'test description',
      schedule: 'test',
      location: 'test location',
      chronicity: 'test',
      master: user.id,
    }

    // master is added to group
    const response = await supertest(BASE_URL)
      .post(`/groups`)
      .set('Authorization', `Bearer ${token}`)
      .send(groupPayload)

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${response.body.group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should list group requests by master', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    const groupRequest = response.body.groupRequest

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests?master=${master.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groupRequests, 'GroupRequests undefined')
    assert.equal(body.groupRequests.length, 1)
    assert.equal(body.groupRequests[0].id, groupRequest.id)
    assert.equal(body.groupRequests[0].userId, groupRequest.userId)
    assert.equal(body.groupRequests[0].groupId, groupRequest.groupId)
    assert.equal(body.groupRequests[0].status, groupRequest.status)
    assert.equal(body.groupRequests[0].group.name, group.name)
    assert.equal(body.groupRequests[0].user.username, user.username)
    assert.equal(body.groupRequests[0].group.master, master.id)
  })

  test('It should return an empty list when master has no group requests', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests?master=${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groupRequests, 'GroupRequests undefined')
    assert.equal(body.groupRequests.length, 0)
  })

  test('It should return 422 when master is not provided', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.exists(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('It should accept a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/${response.body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200)

    assert.exists(body.groupRequest, 'GroupRequest undefined')
    assert.equal(body.groupRequest.userId, user.id)
    assert.equal(body.groupRequest.groupId, group.id)
    assert.equal(body.groupRequest.status, 'ACCEPTED')

    await group.load('players')
    assert.isNotEmpty(group.players)
    assert.equal(group.players.length, 1)
    assert.equal(group.players[0].id, user.id)
  })

  test('It should return 404 when providing an unexisting group', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .post(`/groups/123/requests/${response.body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('It should return 404 when providing an unexisting group request', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/123/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('It should reject a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/${response.body.groupRequest.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200)

    const groupRquest = await GroupRequest.find(response.body.groupRequest.id)
    assert.isNull(groupRquest)
  })

  test('It should return 404 when providing an unexisting group for rejection', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const { body } = await supertest(BASE_URL)
      .delete(`/groups/123/requests/${response.body.groupRequest.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('It should return 404 when providing an unexisting group request for rejection', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/123`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })
})
