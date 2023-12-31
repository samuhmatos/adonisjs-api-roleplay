import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BadRequestException from 'App/Exceptions/BadRequestException'
import Group from 'App/Models/Group'
import GroupRequest from 'App/Models/GroupRequest'

export default class GroupRequestsController {
  public async store({ request, response, auth }: HttpContextContract) {
    const groupId = request.param('groupId') as number
    const userId = auth.user!.id

    const existGroupRequest = await GroupRequest.query()
      .where('groupId', groupId)
      .andWhere('userId', userId)
      .first()

    if (existGroupRequest) throw new BadRequestException('Group request already exists', 409)

    const UserAlreadyInGroup = await Group.query()
      .whereHas('players', (query) => {
        query.where('id', userId)
      })
      .andWhere('id', groupId)
      .first()

    if (UserAlreadyInGroup) throw new BadRequestException('User is already in the group', 422)

    const groupRequest = await GroupRequest.create({ groupId, userId })
    await groupRequest.refresh()

    return response.ok({ groupRequest })
  }

  public async index({ request, response }: HttpContextContract) {
    const { master } = request.qs()

    if (!master) throw new BadRequestException('Master query should be provided', 422)

    const groupRequests = await GroupRequest.query()
      .select('id', 'groupId', 'userId', 'status')
      .preload('group', (query) => {
        query.select('name', 'master')
      })
      .preload('user', (query) => {
        query.select('username')
      })
      .whereHas('group', (query) => {
        query.where('master', Number(master))
      })
      .where('status', 'PENDING')

    return response.ok({ groupRequests })
  }

  public async accept({ request, response, bouncer }: HttpContextContract) {
    const requestId = request.param('requestId') as number
    const groupId = request.param('groupId') as number

    const groupRequest = await GroupRequest.query()
      .where('id', requestId)
      .andWhere('groupId', groupId)
      .firstOrFail()

    await groupRequest.load('group')
    await bouncer.authorize('acceptGroupRequest', groupRequest)

    const updatedGroupRequest = await groupRequest.merge({ status: 'ACCEPTED' }).save()

    await groupRequest.load('group')
    await groupRequest.group.related('players').attach([groupRequest.userId])

    return response.ok({ groupRequest: updatedGroupRequest })
  }

  public async destroy({ request, response, bouncer }: HttpContextContract) {
    const requestId = request.param('requestId') as number
    const groupId = request.param('groupId') as number

    const groupRequest = await GroupRequest.query()
      .where('id', requestId)
      .andWhere('groupId', groupId)
      .firstOrFail()

    await groupRequest.load('group')
    await bouncer.authorize('rejectGroupRequest', groupRequest)

    await groupRequest.delete()
    return response.ok({})
  }
}
