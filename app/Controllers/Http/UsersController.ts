import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BadRequest from 'App/Exceptions/BadRequestException'
import User from 'App/Models/User'
import CreateUserValidator from 'App/Validators/CreateUserValidator'
import UpdateUserValidator from 'App/Validators/UpdateUserValidator'

export default class UsersController {
  public async store({ response, request }: HttpContextContract) {
    const userPayload = await request.validate(CreateUserValidator)

    const userByEmail = await User.findBy('email', userPayload.email)
    const userByUsername = await User.findBy('username', userPayload.username)

    if (userByEmail) throw new BadRequest('email already in use', 409)
    if (userByUsername) throw new BadRequest('username already in use', 409)

    const user = await User.create(userPayload)

    return response.created({ user })
  }

  public async update({ request, response, bouncer }: HttpContextContract) {
    const { email, password, avatar } = await request.validate(UpdateUserValidator)
    const id = request.param('id')

    const user = await User.findOrFail(id)
    await bouncer.authorize('updateUser', user)

    user.email = email
    user.password = password
    if (avatar) user.avatar = avatar
    await user.save()

    return response.ok({ user })
  }
}
