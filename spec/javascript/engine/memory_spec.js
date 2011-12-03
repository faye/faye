JS.ENV.Engine.MemorySpec = JS.Test.describe("Memory engine", function() { with(this) {
  before(function() {
    this.engineOpts = {type: Faye.Engine.Memory}
  })
  
  itShouldBehaveLike("faye engine")
}})
