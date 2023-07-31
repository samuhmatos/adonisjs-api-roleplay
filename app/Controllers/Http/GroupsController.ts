import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BadRequestException from 'App/Exceptions/BadRequestException'
import Group from 'App/Models/Group'
import CreateGroupValidator from 'App/Validators/CreateGroupValidator'

export default class GroupsController {
  public async index({ request, response }: HttpContextContract) {
    const groups = await Group.query().preload('players').preload('masterUser')
    return response.ok({ groups })
  }

  public async store({ request, response, auth }: HttpContextContract) {
    const groupPayload = await request.validate(CreateGroupValidator)
    const group = await Group.create(groupPayload)

    await group.related('players').attach([groupPayload.master])
    await group.load('players')

    return response.created({ group })
  }

  public async update({ request, response, bouncer }: HttpContextContract) {
    const groupId = request.param('id')
    const payload = request.all()

    const group = await Group.findOrFail(groupId)
    await bouncer.authorize('updateGroup', group)

    const updatedGroup = await group.merge(payload).save()
    return response.ok({ group: updatedGroup })
  }

  public async removePlayer({ request, response }: HttpContextContract) {
    const groupId = request.param('groupId') as number
    const playerId = +request.param('playerId')

    const group = await Group.findOrFail(groupId)

    if (playerId === group.master)
      throw new BadRequestException('Cannot remove master from group', 400)

    await group.related('players').detach([playerId])

    return response.ok({})
  }

  public async destroy({ request, response, bouncer }: HttpContextContract) {
    const groupId = request.param('groupId') as number

    const group = await Group.findOrFail(groupId)
    await bouncer.authorize('deleteGroup', group)

    await group.delete()
    //await group.related('players').detach()

    return response.ok({})
  }
}
